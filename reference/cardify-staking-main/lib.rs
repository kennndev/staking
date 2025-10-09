// Simple‑Staking v2 – incorporates audit feedback

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{self, AssociatedToken, Create},
    token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer},
};

declare_id!("2FnwbUJEH151Ecq8KwB9Tsat3NSdQfBAfSWequgXxqW8");

const SCALAR:        u128 = 1_000_000_000_000; // 1e12 fixed‑point
const MAX_DT:        i64  = 7 * 24 * 3600;      // accrual window clamp (7 days)
const MAX_UNPAID:    u128 = u64::MAX as u128;   // cap for carry‑over rewards

/* ───────────────────────── PROGRAM ───────────────────────── */
#[program]
pub mod staking {
    use super::*;

    /* ──────── INITIALISE (staking‑only) ──────── */
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        // 1. create staking_vault ATA (owner = pool_signer)
        let cpi_ctx = CpiContext::new(
            ctx.accounts.associated_token_program.to_account_info(),
            Create {
                payer:            ctx.accounts.admin.to_account_info(),
                associated_token: ctx.accounts.staking_vault.to_account_info(),
                authority:        ctx.accounts.pool_signer.to_account_info(),
                mint:             ctx.accounts.staking_mint.to_account_info(),
                system_program:   ctx.accounts.system_program.to_account_info(),
                token_program:    ctx.accounts.token_program.to_account_info(),
            },
        );
        associated_token::create(cpi_ctx)?;

        // 2. init pool state
        let pool = &mut ctx.accounts.pool;
        pool.admin               = ctx.accounts.admin.key();
        pool.staking_mint        = ctx.accounts.staking_mint.key();
        pool.staking_vault       = ctx.accounts.staking_vault.key();
        pool.reward_configured   = false;
        pool.reward_mint         = Pubkey::default();
        pool.reward_vault        = Pubkey::default();
        pool.reward_rate_per_sec = 0;
        pool.rate_cap            = 0;
        pool.total_staked        = 0;
        pool.acc_scaled          = 0;
        pool.last_update_ts      = Clock::get()?.unix_timestamp;
        pool.paused              = false;
        pool.locked              = false;
        pool.bump                = ctx.bumps.pool;
        pool.signer_bump         = ctx.bumps.pool_signer;

        emit!(PoolInitialized {
            pool:         pool.key(),
            admin:        pool.admin,
            staking_mint: pool.staking_mint,
        });
        Ok(())
    }

    /// One‑shot: set reward mint + initial rate; program creates reward_vault ATA.
    pub fn configure_rewards(ctx: Context<ConfigureRewards>, rate_per_sec: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        reentrancy_guard(pool)?;
        require!(!pool.reward_configured, StakingError::AlreadyConfigured);

        // compute rate cap based on mint decimals (prevents u64 overflow in accumulator maths)
        let decimals = ctx.accounts.reward_mint.decimals as u32;
        pool.rate_cap = (u64::MAX / 10u64.pow(decimals)).saturating_sub(1);
        require!(rate_per_sec <= pool.rate_cap, StakingError::RateTooHigh);

        pool.reward_configured   = true;
        pool.reward_mint         = ctx.accounts.reward_mint.key();
        pool.reward_vault        = ctx.accounts.reward_vault.key();
        pool.reward_rate_per_sec = rate_per_sec;

        emit!(RewardsConfigured { pool: pool.key(), reward_mint: pool.reward_mint, rate_per_sec });
        pool.locked = false; // release re‑entrancy lock
        Ok(())
    }

    /// Admin can adjust reward rate any time after configuration.
    pub fn set_reward_rate(ctx: Context<AdminOnly>, new_rate: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        reentrancy_guard(pool)?;
        require!(pool.reward_configured, StakingError::NotConfigured);
        require!(new_rate <= pool.rate_cap, StakingError::RateTooHigh);
        update_pool(pool, Clock::get()?.unix_timestamp)?;
        pool.reward_rate_per_sec = new_rate;
        emit!(RewardRateUpdated { pool: pool.key(), new_rate });
        pool.locked = false;
        Ok(())
    }

    /// Pause blocks new stakes, but allows claim / unstake.
    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.paused = paused;
        emit!(PausedUpdated { pool: pool.key(), paused });
        Ok(())
    }

    pub fn set_admin(ctx: Context<AdminOnly>, new_admin: Pubkey) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.admin = new_admin;
        emit!(AdminUpdated { pool: pool.key(), new_admin });
        Ok(())
    }

    /// Fund reward vault from admin ATA.
    pub fn fund_rewards(ctx: Context<FundRewards>, amount: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        reentrancy_guard(pool)?;
        require!(pool.reward_configured, StakingError::NotConfigured);
        require!(amount > 0, StakingError::ZeroAmount);
        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.admin_reward_ata.to_account_info(),
                to:        ctx.accounts.reward_vault.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            },
        );
        token::transfer(cpi, amount)?;
        emit!(RewardsFunded { pool: pool.key(), amount });
        pool.locked = false;
        Ok(())
    }

    /// Withdraw reward tokens back to admin; only when paused.
    pub fn withdraw_rewards(ctx: Context<WithdrawRewards>, amount: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        reentrancy_guard(pool)?;
        require!(pool.paused, StakingError::NotPaused);
        require!(pool.reward_configured, StakingError::NotConfigured);

        let pool_key = pool.key();
        let signer_seeds: &[&[u8]] = &[b"pool-signer", pool_key.as_ref(), &[pool.signer_bump]];
        let signer = &[signer_seeds];

        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.reward_vault.to_account_info(),
                to:        ctx.accounts.admin_reward_ata.to_account_info(),
                authority: ctx.accounts.pool_signer.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi, amount)?;
        emit!(RewardsWithdrawn { pool: pool.key(), amount });
        pool.locked = false;
        Ok(())
    }

    /// Safety/ops: recreate any missing ATAs (idempotent).
    pub fn ensure_vaults(ctx: Context<EnsureVaults>) -> Result<()> {
        let pool = &ctx.accounts.pool;

        // staking vault
        if ctx.accounts.staking_vault.data_is_empty() {
            let cpi = CpiContext::new(
                ctx.accounts.associated_token_program.to_account_info(),
                Create {
                    payer:            ctx.accounts.admin.to_account_info(),
                    associated_token: ctx.accounts.staking_vault.to_account_info(),
                    authority:        ctx.accounts.pool_signer.to_account_info(),
                    mint:             ctx.accounts.staking_mint.to_account_info(),
                    system_program:   ctx.accounts.system_program.to_account_info(),
                    token_program:    ctx.accounts.token_program.to_account_info(),
                },
            );
            associated_token::create(cpi)?;
        }

        // reward vault
        if pool.reward_configured {
            let rv = ctx.accounts.reward_vault.as_ref().ok_or(StakingError::NotConfigured)?;
            if rv.data_is_empty() {
                let rm = ctx.accounts.reward_mint.as_ref().ok_or(StakingError::NotConfigured)?;
                let cpi = CpiContext::new(
                    ctx.accounts.associated_token_program.to_account_info(),
                    Create {
                        payer:            ctx.accounts.admin.to_account_info(),
                        associated_token: rv.to_account_info(),
                        authority:        ctx.accounts.pool_signer.to_account_info(),
                        mint:             rm.to_account_info(),
                        system_program:   ctx.accounts.system_program.to_account_info(),
                        token_program:    ctx.accounts.token_program.to_account_info(),
                    },
                );
                associated_token::create(cpi)?;
            }
        }
        emit!(VaultsEnsured { pool: pool.key() });
        Ok(())
    }

    /* ──────── USER FLOWS ──────── */

    pub fn init_user(ctx: Context<InitUser>) -> Result<()> {
        let user = &mut ctx.accounts.user;
        user.owner          = ctx.accounts.owner.key();
        user.staked         = 0;
        user.debt           = 0;
        user.unpaid_rewards = 0;
        user.bump           = ctx.bumps.user;
        Ok(())
    }

    /// Stake (blocked when paused). No auto‑claim.
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);
        let pool = &mut ctx.accounts.pool;
        reentrancy_guard(pool)?;
        require!(!pool.paused, StakingError::Paused);

        update_pool(pool, Clock::get()?.unix_timestamp)?;

        // transfer in
        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.user_staking_ata.to_account_info(),
                to:        ctx.accounts.staking_vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );
        token::transfer(cpi, amount)?;

        // accounting
        let user = &mut ctx.accounts.user;
        if user.owner == Pubkey::default() { user.owner = ctx.accounts.owner.key(); }
        user.staked       = user.staked.checked_add(amount).ok_or(StakingError::Overflow)?;
        pool.total_staked = pool.total_staked.checked_add(amount).ok_or(StakingError::Overflow)?;
        user.debt         = calc(user.staked, pool.acc_scaled);

        emit!(Staked { pool: pool.key(), user: user.owner, amount });
        pool.locked = false;
        Ok(())
    }

    /// Unstake principal (allowed while paused).
    pub fn unstake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);
        let pool = &mut ctx.accounts.pool;
        reentrancy_guard(pool)?;

        update_pool(pool, Clock::get()?.unix_timestamp)?;

        let user = &mut ctx.accounts.user;
        require!(user.staked >= amount, StakingError::InsufficientStake);

        let pool_key = pool.key();
        let signer_seeds: &[&[u8]] = &[b"pool-signer", pool_key.as_ref(), &[pool.signer_bump]];
        let signer = &[signer_seeds];

        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.staking_vault.to_account_info(),
                to:        ctx.accounts.user_staking_ata.to_account_info(),
                authority: ctx.accounts.pool_signer.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi, amount)?;

        user.staked       = user.staked.checked_sub(amount).ok_or(StakingError::Underflow)?;
        pool.total_staked = pool.total_staked.checked_sub(amount).ok_or(StakingError::Underflow)?;
        user.debt         = calc(user.staked, pool.acc_scaled);

        emit!(Unstaked { pool: pool.key(), user: user.owner, amount });
        pool.locked = false;
        Ok(())
    }

    /// Emergency exit: principal only, no rewards.
    pub fn emergency_unstake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);
        let pool = &mut ctx.accounts.pool; // borrow mut for seed
        reentrancy_guard(pool)?;

        let user = &mut ctx.accounts.user;
        require!(user.staked >= amount, StakingError::InsufficientStake);

        let pool_key = pool.key();
        let signer_seeds: &[&[u8]] = &[b"pool-signer", pool_key.as_ref(), &[pool.signer_bump]];
        let signer = &[signer_seeds];

        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.staking_vault.to_account_info(),
                to:        ctx.accounts.user_staking_ata.to_account_info(),
                authority: ctx.accounts.pool_signer.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi, amount)?;

        user.staked       = user.staked.checked_sub(amount).ok_or(StakingError::Underflow)?;
        pool.total_staked = pool.total_staked.checked_sub(amount).ok_or(StakingError::Underflow)?;

        emit!(EmergencyUnstaked { pool: pool_key, user: user.owner, amount });
        pool.locked = false;
        Ok(())
    }

    /// Claim rewards (allowed while paused). Pays vault funds, carries unpaid remainder.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        reentrancy_guard(pool)?;
        require!(pool.reward_configured, StakingError::NotConfigured);

        update_pool(pool, Clock::get()?.unix_timestamp)?;

        let user = &mut ctx.accounts.user;
        let pending_amt = pending(user, pool);
        let total_due   = pending_amt.saturating_add(user.unpaid_rewards);

        if total_due > 0 {
            let available = ctx.accounts.reward_vault.amount as u128;
            let to_pay    = core::cmp::min(total_due, available);

            if to_pay > 0 {
                let pool_key = pool.key();
                let signer_seeds: &[&[u8]] = &[b"pool-signer", pool_key.as_ref(), &[pool.signer_bump]];
                let signer = &[signer_seeds];

                let cpi = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from:      ctx.accounts.reward_vault.to_account_info(),
                        to:        ctx.accounts.user_reward_ata.to_account_info(),
                        authority: ctx.accounts.pool_signer.to_account_info(),
                    },
                    signer,
                );
                token::transfer(cpi, to_pay as u64)?;
                emit!(RewardsClaimed { pool: pool.key(), user: user.owner, amount: to_pay as u64 });
            }
            let remaining = total_due.saturating_sub(to_pay).min(MAX_UNPAID);
            user.unpaid_rewards = remaining;
        }

        user.debt = calc(user.staked, pool.acc_scaled);
        pool.locked = false;
        Ok(())
    }

    /// Close user record (no stake, no pending, no unpaid).
    pub fn close_user(_ctx: Context<CloseUser>) -> Result<()> { Ok(()) }

    /// Close pool once paused, all stakes withdrawn, vaults emptied.
    pub fn close_pool(ctx: Context<ClosePool>) -> Result<()> {
        let pool = &ctx.accounts.pool;
        require!(pool.paused, StakingError::NotPaused);
        require!(pool.total_staked == 0, StakingError::NonZeroStake);
        require!(ctx.accounts.staking_vault.amount == 0, StakingError::VaultNotEmpty);

        if pool.reward_configured {
            let rv_opt = ctx.accounts.reward_vault.as_ref();
            require!(rv_opt.is_some(), StakingError::VaultNotEmpty);
            let rv = rv_opt.unwrap();
            require!(rv.amount == 0, StakingError::VaultNotEmpty);

            let pool_key = pool.key();
            let signer_seeds: &[&[u8]] = &[b"pool-signer", pool_key.as_ref(), &[pool.signer_bump]];
            let signer = &[signer_seeds];

            let close_rv = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account:      rv.to_account_info(),
                    destination: ctx.accounts.admin.to_account_info(),
                    authority:   ctx.accounts.pool_signer.to_account_info(),
                },
                signer,
            );
            token::close_account(close_rv)?;
        }

        // close staking vault
        let pool_key = pool.key();
        let signer_seeds: &[&[u8]] = &[b"pool-signer", pool_key.as_ref(), &[pool.signer_bump]];
        let signer = &[signer_seeds];
        let close_sv = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account:      ctx.accounts.staking_vault.to_account_info(),
                destination: ctx.accounts.admin.to_account_info(),
                authority:   ctx.accounts.pool_signer.to_account_info(),
            },
            signer,
        );
        token::close_account(close_sv)?;
        Ok(())
    }
}

/* ───────────────────────── HELPERS ───────────────────────── */

fn reentrancy_guard(pool: &mut Account<Pool>) -> Result<()> {
    require!(!pool.locked, StakingError::Reentrancy);
    pool.locked = true;
    Ok(())
}

fn update_pool(pool: &mut Account<Pool>, now: i64) -> Result<()> {
    if now <= pool.last_update_ts { return Ok(()); }
    let raw = now - pool.last_update_ts;
    let dt_i64 = if raw > MAX_DT { MAX_DT } else { raw };
    pool.last_update_ts = now;

    if pool.total_staked > 0 && pool.reward_configured && pool.reward_rate_per_sec > 0 {
        let add = (dt_i64 as u128)
            .checked_mul(pool.reward_rate_per_sec as u128).ok_or(StakingError::Overflow)?
            .checked_mul(SCALAR).ok_or(StakingError::Overflow)?
            .checked_div(pool.total_staked as u128).ok_or(StakingError::Underflow)?;
        pool.acc_scaled = pool.acc_scaled.checked_add(add).ok_or(StakingError::Overflow)?;
    }
    Ok(())
}

fn calc(amount: u64, acc_scaled: u128) -> u128 {
    (amount as u128)
        .saturating_mul(acc_scaled)
        .checked_div(SCALAR)
        .unwrap_or(0)
}

fn pending(user: &Account<User>, pool: &Account<Pool>) -> u128 {
    if user.staked == 0 { return 0; }
    calc(user.staked, pool.acc_scaled).saturating_sub(user.debt)
}

/* ───────────────────────── STATE ───────────────────────── */

#[account]
pub struct Pool {
    pub admin:             Pubkey, // 32
    pub staking_mint:      Pubkey, // 32
    pub staking_vault:     Pubkey, // 32

    pub reward_configured: bool,   // 1
    pub reward_mint:       Pubkey, // 32
    pub reward_vault:      Pubkey, // 32
    pub reward_rate_per_sec: u64,  // 8
    pub rate_cap:          u64,    // 8 (dynamic cap per decimals)

    pub total_staked:      u64,    // 8
    pub acc_scaled:        u128,   // 16
    pub last_update_ts:    i64,    // 8
    pub paused:            bool,   // 1
    pub locked:            bool,   // 1 – re‑entrancy lock

    pub bump:              u8,     // 1
    pub signer_bump:       u8,     // 1

    pub _reserved: [u8; 44],      // pad for future upgrades (was 53)
}

#[account]
pub struct User {
    pub owner:          Pubkey, // 32
    pub staked:         u64,    // 8
    pub debt:           u128,   // 16
    pub unpaid_rewards: u128,   // 16
    pub bump:           u8,     // 1
    pub _reserved: [u8; 23],    // padding
}

/* ───────────────────────── EVENTS ───────────────────────── */

#[event] pub struct PoolInitialized   { pub pool: Pubkey, pub admin: Pubkey, pub staking_mint: Pubkey }
#[event] pub struct RewardsConfigured { pub pool: Pubkey, pub reward_mint: Pubkey, pub rate_per_sec: u64 }
#[event] pub struct RewardRateUpdated { pub pool: Pubkey, pub new_rate: u64 }
#[event] pub struct PausedUpdated     { pub pool: Pubkey, pub paused: bool }
#[event] pub struct AdminUpdated      { pub pool: Pubkey, pub new_admin: Pubkey }
#[event] pub struct RewardsFunded     { pub pool: Pubkey, pub amount: u64 }
#[event] pub struct RewardsWithdrawn  { pub pool: Pubkey, pub amount: u64 }
#[event] pub struct Staked            { pub pool: Pubkey, pub user: Pubkey, pub amount: u64 }
#[event] pub struct Unstaked          { pub pool: Pubkey, pub user: Pubkey, pub amount: u64 }
#[event] pub struct EmergencyUnstaked { pub pool: Pubkey, pub user: Pubkey, pub amount: u64 }
#[event] pub struct RewardsClaimed    { pub pool: Pubkey, pub user: Pubkey, pub amount: u64 }
#[event] pub struct VaultsEnsured     { pub pool: Pubkey }

/* ───────────────────────── ERRORS ───────────────────────── */

#[error_code]
pub enum StakingError {
    #[msg("Paused")]              Paused,
    #[msg("Not paused")]          NotPaused,
    #[msg("Already configured")]  AlreadyConfigured,
    #[msg("Rewards not configured")] NotConfigured,
    #[msg("Amount must be > 0")] ZeroAmount,
    #[msg("Insufficient stake")] InsufficientStake,
    #[msg("Overflow")]           Overflow,
    #[msg("Underflow")]          Underflow,
    #[msg("Vault must be empty to close")] VaultNotEmpty,
    #[msg("Pool still has stake")]       NonZeroStake,
    #[msg("Emission rate too high")]    RateTooHigh,
    #[msg("Re‑entrancy detected")]      Reentrancy,
}

/* ─────────────────── ACCOUNTS ─────────────────── */

#[derive(Accounts)]
pub struct Initialize<'info> {
    // fee payer & pool admin
    #[account(mut)]
    pub admin: Signer<'info>,

    // SPL-Token mint users will stake
    pub staking_mint: Account<'info, Mint>,

    // pool state PDA
    #[account(
        init,
        payer  = admin,
        seeds  = [b"pool", staking_mint.key().as_ref()],
        bump,
        space  = 8 + core::mem::size_of::<Pool>(),
    )]
    pub pool: Account<'info, Pool>,

    /// CHECK: PDA that owns vaults
    #[account(
        seeds = [b"pool-signer", pool.key().as_ref()],
        bump
    )]
    pub pool_signer: UncheckedAccount<'info>,

    // **will be created inside the instruction – pass as Unchecked**
    #[account(mut)]
    pub staking_vault: UncheckedAccount<'info>,

    /* programs */
    pub token_program:           Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program:          Program<'info, System>,
    pub rent:                    Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ConfigureRewards<'info> {
    #[account(mut, has_one = admin)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub reward_mint: Account<'info, Mint>,

    /// CHECK: PDA authority for the vault
    #[account(
        seeds = [b"pool-signer", pool.key().as_ref()],
        bump = pool.signer_bump
    )]
    pub pool_signer: UncheckedAccount<'info>,

    #[account(
        init_if_needed,                
        payer = admin,
        associated_token::mint = reward_mint,
        associated_token::authority = pool_signer
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}


#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut, has_one = admin)]
    pub pool: Account<'info, Pool>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct FundRewards<'info> {
    #[account(mut, has_one = admin)]
    pub pool: Account<'info, Pool>,
    pub admin: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = pool.reward_mint,
        associated_token::authority = admin
    )]
    pub admin_reward_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = pool.reward_vault
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct WithdrawRewards<'info> {
    #[account(mut, has_one = admin)]
    pub pool: Account<'info, Pool>,
    pub admin: Signer<'info>,

    /// CHECK: PDA authority
    #[account(
        seeds = [b"pool-signer", pool.key().as_ref()],
        bump = pool.signer_bump
    )]
    pub pool_signer: UncheckedAccount<'info>,

    #[account(mut, address = pool.reward_vault)]
    pub reward_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = pool.reward_mint,
        associated_token::authority = admin
    )]
    pub admin_reward_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct EnsureVaults<'info> {
    #[account(mut, has_one = admin)]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: PDA authority
    #[account(
        seeds = [b"pool-signer", pool.key().as_ref()],
        bump = pool.signer_bump
    )]
    pub pool_signer: UncheckedAccount<'info>,

    pub staking_mint: Account<'info, Mint>,

    // Use UncheckedAccount for vaults so missing ATAs don't break deserialization
    #[account(mut)]
    pub staking_vault: UncheckedAccount<'info>,
    pub reward_mint: Option<Account<'info, Mint>>,
    #[account(mut)]
    pub reward_vault: Option<UncheckedAccount<'info>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitUser<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub pool: Account<'info, Pool>,
    #[account(
        init,
        payer = owner,
        seeds = [b"user", pool.key().as_ref(), owner.key().as_ref()],
        bump,
        space = 8 + core::mem::size_of::<User>(),
    )]
    pub user: Account<'info, User>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    /// CHECK
    #[account(
        seeds = [b"pool-signer", pool.key().as_ref()],
        bump = pool.signer_bump
    )]
    pub pool_signer: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = pool.staking_mint,
        associated_token::authority = owner
    )]
    pub user_staking_ata: Account<'info, TokenAccount>,

    #[account(mut, address = pool.staking_vault)]
    pub staking_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        seeds = [b"user", pool.key().as_ref(), owner.key().as_ref()],
        bump,
        space = 8 + core::mem::size_of::<User>(),
    )]
    pub user: Account<'info, User>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    /// CHECK
    #[account(
        seeds = [b"pool-signer", pool.key().as_ref()],
        bump = pool.signer_bump
    )]
    pub pool_signer: UncheckedAccount<'info>,

    #[account(mut, address = pool.reward_vault)]
    pub reward_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = pool.reward_mint,
        associated_token::authority = owner
    )]
    pub user_reward_ata: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"user", pool.key().as_ref(), owner.key().as_ref()], bump)]
    pub user: Account<'info, User>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct CloseUser<'info> {
    pub owner: Signer<'info>,
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        close = owner,
        seeds = [b"user", pool.key().as_ref(), owner.key().as_ref()],
        bump,
        constraint = user.staked == 0 @ StakingError::NonZeroStake,
        constraint = (calc(user.staked, pool.acc_scaled).saturating_sub(user.debt) == 0) && (user.unpaid_rewards == 0)
            @ StakingError::VaultNotEmpty
    )]
    pub user: Account<'info, User>,
}

#[derive(Accounts)]
pub struct ClosePool<'info> {
    #[account(mut, has_one = admin)]
    pub pool: Account<'info, Pool>,
    pub admin: Signer<'info>,

    /// CHECK: PDA authority
    #[account(
        seeds = [b"pool-signer", pool.key().as_ref()],
        bump = pool.signer_bump
    )]
    pub pool_signer: UncheckedAccount<'info>,

    #[account(mut, address = pool.staking_vault)]
    pub staking_vault: Account<'info, TokenAccount>,

    // Optional by interface; required when reward_configured
    #[account(mut)]
    pub reward_vault: Option<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}
