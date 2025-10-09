/* eslint-disable @typescript-eslint/no-explicit-any */
// Clean PDA and initialization helpers
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN, Program } from '@coral-xyz/anchor';

export function poolPda(programId: PublicKey, stakingMint: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("pool"), stakingMint.toBuffer()], programId)[0];
}

export function signerPda(programId: PublicKey, pool: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("pool-signer"), pool.toBuffer()], programId)[0];
}

export function userPda(programId: PublicKey, pool: PublicKey, owner: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("user"), pool.toBuffer(), owner.toBuffer()], programId)[0];
}

export async function initialize({
  program, admin, stakingMint
}: {
  program: Program, admin: PublicKey, stakingMint: PublicKey
}) {
  const pool   = poolPda(program.programId, stakingMint);
  const signer = signerPda(program.programId, pool);
  const stakingVault = await getAssociatedTokenAddress(stakingMint, signer, true);

  console.log('Initializing pool:', {
    pool: pool.toBase58(),
    signer: signer.toBase58(),
    stakingVault: stakingVault.toBase58(),
    stakingMint: stakingMint.toBase58()
  });

  const tx = await program.methods.initialize().accounts({
    admin, stakingMint, pool, signer, stakingVault,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  }).rpc();

  console.log('✅ Pool initialized successfully:', tx);

  // sanity fetch
  const acc: any = await (program.account as any).pool.fetch(pool);
  return { pool, signer, stakingVault, acc, tx };
}

export async function setRewardConfig({
  program, admin, pool, rewardMint, ratePerSec
}: {
  program: Program, admin: PublicKey, pool: PublicKey, rewardMint: PublicKey, ratePerSec: BN | number
}) {
  const signer = signerPda(program.programId, pool);
  const rewardVault = await getAssociatedTokenAddress(rewardMint, signer, true);

  console.log('Setting reward config:', {
    pool: pool.toBase58(),
    rewardMint: rewardMint.toBase58(),
    rewardVault: rewardVault.toBase58(),
    ratePerSec: ratePerSec.toString()
  });

  const tx = await program.methods.setRewardConfig(new BN(ratePerSec)).accounts({
    pool, admin, rewardMint, signer, rewardVault,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  }).rpc();

  console.log('✅ Reward config set successfully:', tx);
  return { rewardVault, tx };
}

export async function stakeTokens({
  program, owner, pool, stakingMint, amount
}: {
  program: Program, owner: PublicKey, pool: PublicKey, stakingMint: PublicKey, amount: number
}) {
  const signer = signerPda(program.programId, pool);
  const user = userPda(program.programId, pool, owner);
  const userStakingAta = await getAssociatedTokenAddress(stakingMint, owner);
  const stakingVault = await getAssociatedTokenAddress(stakingMint, signer);

  console.log('Staking tokens:', {
    amount,
    user: user.toBase58(),
    userStakingAta: userStakingAta.toBase58(),
    stakingVault: stakingVault.toBase58()
  });

  const tx = await program.methods.stake(new BN(amount)).accounts({
    owner, pool, signer, userStakingAta, stakingVault, user,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
  }).rpc();

  console.log('✅ Tokens staked successfully:', tx);
  return tx;
}

export async function unstakeTokens({
  program, owner, pool, stakingMint, amount
}: {
  program: Program, owner: PublicKey, pool: PublicKey, stakingMint: PublicKey, amount: number
}) {
  const signer = signerPda(program.programId, pool);
  const user = userPda(program.programId, pool, owner);
  const userStakingAta = await getAssociatedTokenAddress(stakingMint, owner);
  const stakingVault = await getAssociatedTokenAddress(stakingMint, signer);

  console.log('Unstaking tokens:', {
    amount,
    user: user.toBase58(),
    userStakingAta: userStakingAta.toBase58(),
    stakingVault: stakingVault.toBase58()
  });

  const tx = await program.methods.unstake(new BN(amount)).accounts({
    owner, pool, signer, stakingVault, userStakingAta, user,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).rpc();

  console.log('✅ Tokens unstaked successfully:', tx);
  return tx;
}

export async function claimRewards({
  program, owner, pool, rewardMint
}: {
  program: Program, owner: PublicKey, pool: PublicKey, rewardMint: PublicKey
}) {
  const signer = signerPda(program.programId, pool);
  const user = userPda(program.programId, pool, owner);
  const userRewardAta = await getAssociatedTokenAddress(rewardMint, owner);
  const rewardVault = await getAssociatedTokenAddress(rewardMint, signer);

  console.log('Claiming rewards:', {
    user: user.toBase58(),
    userRewardAta: userRewardAta.toBase58(),
    rewardVault: rewardVault.toBase58()
  });

  const tx = await program.methods.claim().accounts({
    owner, pool, signer, rewardVault, userRewardAta, user,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  }).rpc();

  console.log('✅ Rewards claimed successfully:', tx);
  return tx;
}

export async function fetchPoolData(program: Program, pool: PublicKey) {
  try {
    const acc: any = await (program.account as any).pool.fetch(pool);
    return {
      poolAddress: pool.toString(),
      admin: acc.admin.toString(),
      stakingMint: acc.stakingMint.toString(),
      stakingVault: acc.stakingVault.toString(),
      rewardConfigured: acc.rewardConfigured,
      rewardMint: acc.rewardMint.toString(),
      rewardVault: acc.rewardVault.toString(),
      rewardRatePerSec: acc.rewardRatePerSec.toNumber(),
      rateCap: acc.rateCap.toNumber(),
      totalStaked: acc.totalStaked.toNumber(),
      accScaled: acc.accScaled.toString(),
      lastUpdateTs: acc.lastUpdateTs.toNumber(),
      paused: acc.paused,
      locked: acc.locked,
      bump: acc.bump,
      signerBump: acc.signerBump,
    };
  } catch (error) {
    console.error('Error fetching pool data:', error);
    return null;
  }
}

export async function fetchUserData(program: Program, pool: PublicKey, owner: PublicKey) {
  try {
    const user = userPda(program.programId, pool, owner);
    const acc: any = await (program.account as any).user.fetch(user);
    return {
      owner: acc.owner.toString(),
      staked: acc.staked.toNumber(),
      debt: acc.debt.toString(),
      unpaidRewards: acc.unpaidRewards.toString(),
      bump: acc.bump,
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
}

// Emergency unstake - principal only, no rewards
export async function emergencyUnstakeTokens({
  program, owner, pool, stakingMint, amount
}: {
  program: Program, owner: PublicKey, pool: PublicKey, stakingMint: PublicKey, amount: number
}) {
  const signer = signerPda(program.programId, pool);
  const user = userPda(program.programId, pool, owner);
  const userStakingAta = await getAssociatedTokenAddress(stakingMint, owner);
  const stakingVault = await getAssociatedTokenAddress(stakingMint, signer);

  console.log('Emergency unstaking tokens:', {
    amount,
    user: user.toBase58(),
    userStakingAta: userStakingAta.toBase58(),
    stakingVault: stakingVault.toBase58()
  });

  const tx = await program.methods.emergencyUnstake(new BN(amount)).accounts({
    owner, pool, signer, userStakingAta, stakingVault, user,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  }).rpc();

  console.log('✅ Tokens emergency unstaked successfully:', tx);
  return tx;
}

// Admin function: withdraw rewards (only when paused)
export async function withdrawRewards({
  program, admin, pool, rewardMint, amount
}: {
  program: Program, admin: PublicKey, pool: PublicKey, rewardMint: PublicKey, amount: number
}) {
  const signer = signerPda(program.programId, pool);
  const rewardVault = await getAssociatedTokenAddress(rewardMint, signer);
  const adminRewardAta = await getAssociatedTokenAddress(rewardMint, admin);

  console.log('Withdrawing rewards:', {
    amount,
    pool: pool.toBase58(),
    rewardVault: rewardVault.toBase58(),
    adminRewardAta: adminRewardAta.toBase58()
  });

  const tx = await program.methods.withdrawRewards(new BN(amount)).accounts({
    pool, admin, signer, rewardVault, adminRewardAta,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  }).rpc();

  console.log('✅ Rewards withdrawn successfully:', tx);
  return tx;
}

// Admin function: set new admin
export async function setAdmin({
  program, admin, pool, newAdmin
}: {
  program: Program, admin: PublicKey, pool: PublicKey, newAdmin: PublicKey
}) {
  console.log('Setting new admin:', {
    pool: pool.toBase58(),
    currentAdmin: admin.toBase58(),
    newAdmin: newAdmin.toBase58()
  });

  const tx = await program.methods.setAdmin(newAdmin).accounts({
    pool, admin,
  }).rpc();

  console.log('✅ Admin updated successfully:', tx);
  return tx;
}

// Admin function: ensure vaults exist (recreate missing ATAs)
export async function ensureVaults({
  program, admin, pool, stakingMint, rewardMint
}: {
  program: Program, admin: PublicKey, pool: PublicKey, stakingMint: PublicKey, rewardMint?: PublicKey
}) {
  const signer = signerPda(program.programId, pool);
  const stakingVault = await getAssociatedTokenAddress(stakingMint, signer);
  
  const accounts: any = {
    pool, admin, signer, stakingMint, stakingVault,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };

  // Add reward vault if reward mint is provided
  if (rewardMint) {
    const rewardVault = await getAssociatedTokenAddress(rewardMint, signer);
    accounts.rewardMint = rewardMint;
    accounts.rewardVault = rewardVault;
  }

  console.log('Ensuring vaults exist:', {
    pool: pool.toBase58(),
    stakingVault: stakingVault.toBase58(),
    rewardMint: rewardMint?.toBase58(),
  });

  const tx = await program.methods.ensureVaults().accounts(accounts).rpc();

  console.log('✅ Vaults ensured successfully:', tx);
  return tx;
}

// Close user account (no stake, no pending, no unpaid)
export async function closeUser({
  program, owner, pool
}: {
  program: Program, owner: PublicKey, pool: PublicKey
}) {
  const user = userPda(program.programId, pool, owner);

  console.log('Closing user account:', {
    user: user.toBase58(),
    owner: owner.toBase58(),
    pool: pool.toBase58()
  });

  const tx = await program.methods.closeUser().accounts({
    owner, pool, user,
  }).rpc();

  console.log('✅ User account closed successfully:', tx);
  return tx;
}

// Close pool (only when paused, all stakes withdrawn, vaults emptied)
export async function closePool({
  program, admin, pool, stakingMint, rewardMint
}: {
  program: Program, admin: PublicKey, pool: PublicKey, stakingMint: PublicKey, rewardMint?: PublicKey
}) {
  const signer = signerPda(program.programId, pool);
  const stakingVault = await getAssociatedTokenAddress(stakingMint, signer);
  
  const accounts: any = {
    pool, admin, signer, stakingVault,
    tokenProgram: TOKEN_PROGRAM_ID,
  };

  // Add reward vault if reward mint is provided
  if (rewardMint) {
    const rewardVault = await getAssociatedTokenAddress(rewardMint, signer);
    accounts.rewardVault = rewardVault;
  }

  console.log('Closing pool:', {
    pool: pool.toBase58(),
    stakingVault: stakingVault.toBase58(),
    rewardVault: accounts.rewardVault?.toBase58(),
  });

  const tx = await program.methods.closePool().accounts(accounts).rpc();

  console.log('✅ Pool closed successfully:', tx);
  return tx;
}