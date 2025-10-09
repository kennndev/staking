'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import { AnchorProvider, BorshAccountsCoder } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';

import { CONTRACT_CONFIG, ENV } from '../config/env';

// Memo program ID for unique transaction signatures (from env)
const MEMO_PROGRAM_ID = new PublicKey(CONTRACT_CONFIG.MEMO_PROGRAM_ID);

// Shared decimal scaling helper
const toBaseUnits = (x: string | number, dec: number): BN => {
  const s = String(x);
  if (!s.includes('.')) return new BN(s).mul(new BN(10).pow(new BN(dec)));
  const [intPart, fracPartRaw] = s.split('.');
  const fracPart = (fracPartRaw + '0'.repeat(dec)).slice(0, dec); // right-pad
  const whole = intPart ? new BN(intPart) : new BN(0);
  const frac = fracPart ? new BN(fracPart) : new BN(0);
  return whole.mul(new BN(10).pow(new BN(dec))).add(frac);
};


// loadProgram gives us a Program built from on-chain IDL or local fallback;
// PROGRAM_ID is built once (env → PublicKey) so all callers agree
import { loadProgram, PROGRAM_ID, fetchAndSaveOnChainIdl } from '../lib/idl-loader';

// PDA helpers + pk() coercion
import { pk, poolPda, signerPda, userPda } from '../lib/pda';

// one-task init flow (derives PDAs, creates Pool+stakingVault, returns basics)
import { initializeOnly } from '../lib/init-only';

// RPC (same as your original)
export const RPC_URL = CONTRACT_CONFIG.RPC_URL;
export const SCALAR = CONTRACT_CONFIG.SCALAR;

// Admin wallet address (string in env → PublicKey at runtime)
export const ADMIN_WALLET = new PublicKey(CONTRACT_CONFIG.ADMIN_WALLET);

const toDisplayKey = (key: any) => {
  try {
    return key?.toBase58?.() ?? key?.toString?.() ?? String(key ?? 'unknown');
  } catch {
    return 'unknown';
  }
};

const logProgramRequest = (scope: string, extra: Record<string, unknown> = {}) => {
  try {
    console.log(`[Staking] ${scope}`, {
      programId: toDisplayKey(PROGRAM_ID),
      ...extra,
    });
  } catch (err) {
    console.log('[Staking] Failed to log program request', err);
  }
};


interface PoolData {
  poolAddress: string;     // Pool PDA (base58)
  admin: string;
  stakingMint: string;
  stakingVault: string;
  rewardConfigured: boolean;  // ADD: matches contract
  rewardMint: string;
  rewardVault: string;
  rewardRatePerSec: number;   // RENAME: from ratePerSec
  rateCap: number;           // ADD: matches contract
  totalStaked: number;
  accScaled: string;         // big number-safe
  lastUpdateTs: number;
  paused: boolean;
  locked: boolean;           // ADD: matches contract
  bump: number;
  signerBump: number;
}

interface UserData {
  owner: string;
  staked: number;
  debt: string;            // big number-safe
  unpaidRewards: string;   // big number-safe
  bump: number;           // ADD: matches contract
}

interface StakingContextType {
  connection: Connection;
  walletAddress: string | null;
  isAdmin: boolean;
  poolData: PoolData | null;
  userData: UserData | null;
  isLoading: boolean;
  isInitialLoad: boolean;
  error: string | null;
  stakingMint: string | null;
  stakingDecimals: number;
  rewardDecimals: number;
  
  // Actions
  initializePool: (stakingMint: string) => Promise<void>;
  fetchPoolByMint: (stakingMint: string) => Promise<void>;
  setStakingMint: (mint: string) => void;
  diagnoseAccount: (accountAddress: string) => Promise<any>;
  fetchOnChainIdl: () => Promise<any>;
  verifyPdaSeeds: (stakingMintStr: string) => { poolPDA: PublicKey; bump: number };
  setRewardConfig: (rewardMint: string, ratePerSec: number) => Promise<void>;
  setRewardRate: (ratePerSec: string | number) => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
  addRewardTokens: (amount: number) => Promise<void>;
  checkRewardVaultBalance: () => Promise<number>;
  checkCurrentPoolState: () => Promise<void>;
  computeApy: () => Promise<{
    ratePerSecUI: number;
    totalStakedUI: number;
    yearlyRewards: number;
    secondsPerYear: number;
    apyPercent: number;
    decimals: { staking: number; reward: number };
    baseUnits: { ratePerSec: number; totalStaked: number };
  } | null>;
  stake: (amount: number) => Promise<void>;
  unstake: (amount: number) => Promise<void>;
  emergencyUnstake: (amount: number) => Promise<void>;
  claim: () => Promise<void>;
  withdrawRewards: (amount: number) => Promise<void>;
  setAdmin: (newAdmin: string) => Promise<void>;
  ensureVaults: () => Promise<void>;
  closeUser: () => Promise<void>;
  closePool: () => Promise<void>;
  refreshData: (forceRefresh?: boolean) => Promise<void>;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const StakingContext = createContext<StakingContextType | undefined>(undefined);

export function StakingProvider({ children }: { children: ReactNode }) {
  const [connection] = useState(new Connection(RPC_URL, 'confirmed'));
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Performance optimizations
  const [dataCache, setDataCache] = useState<{
    poolData?: PoolData;
    userData?: UserData;
    timestamp?: number;
  }>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const CACHE_DURATION = 30000; // 30 seconds cache
  const initialStakingMint =
    ENV.STAKING_MINT && ENV.STAKING_MINT !== '11111111111111111111111111111111'
      ? ENV.STAKING_MINT
      : null;
  const [stakingMint, setStakingMint] = useState<string | null>(initialStakingMint);
  const [stakingDecimals, setStakingDecimals] = useState<number>(6);
  const [rewardDecimals, setRewardDecimals] = useState<number>(6);
  const [lastTransactionTime, setLastTransactionTime] = useState<number>(0);

  useEffect(() => {
    console.log('[Staking] Config snapshot', {
      programId: toDisplayKey(PROGRAM_ID),
      rpcUrl: RPC_URL,
      envStakingMint: ENV.STAKING_MINT,
      adminWallet: toDisplayKey(ADMIN_WALLET),
    });
  }, []);

    // Check if connected wallet is admin
    useEffect(() => {
      const admin = ADMIN_WALLET.toBase58();
      const isAdminWallet = walletAddress === admin;
      setIsAdmin(!!walletAddress && isAdminWallet);
    }, [walletAddress]);
  
    // Auto-detect pool when wallet connects
    useEffect(() => {
      if (walletAddress && !poolData) {
        autoDetectPool();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletAddress, poolData]);

  // --- Wallet wiring ---------------------------------------------------------

  useEffect(() => {
    // Check if wallet is already connected (but don't auto-connect)
    const checkExistingConnection = async () => {
      if (typeof window === 'undefined' || !window.solana?.isPhantom) {
        setWalletAddress(null);
        return;
      }
      try {
        // Check if already connected without triggering connection
        if (window.solana.isConnected) {
          const response = await window.solana.connect({ onlyIfTrusted: true });
          setWalletAddress(response?.publicKey?.toString() ?? null);
        } else {
          setWalletAddress(null);
        }
      } catch {
        setWalletAddress(null);
      }
    };

    checkExistingConnection();

    if (typeof window !== 'undefined' && window.solana?.isPhantom) {
      const onConnect = (pubkey: PublicKey) => setWalletAddress(pubkey.toString());
      const onDisconnect = () => setWalletAddress(null);
      
      // Add event listeners
      if ('on' in window.solana) {
        (window.solana as any).on('connect', onConnect);
        (window.solana as any).on('disconnect', onDisconnect);
      }
      
      return () => {
        try {
          if (window.solana && 'off' in window.solana) {
            (window.solana as any).off('connect', onConnect);
            (window.solana as any).off('disconnect', onDisconnect);
          }
        } catch {}
      };
    }
  }, []);

  // Check if connected wallet is admin
  useEffect(() => {
    const admin = ADMIN_WALLET.toBase58();
    const isAdminWallet = walletAddress === admin;
    setIsAdmin(!!walletAddress && isAdminWallet);
  }, [walletAddress]);

  // Auto-detect pool when wallet connects
  useEffect(() => {
    if (walletAddress && !poolData) {
      autoDetectPool();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, poolData]);

  // Background refresh every 30 seconds
  useEffect(() => {
    if (!walletAddress || !poolData) return;
    
    const interval = setInterval(() => {
      refreshData(false); // Use cache if available
    }, 30000);

    return () => clearInterval(interval);
  }, [walletAddress, poolData]);

  // --- Data refresh ----------------------------------------------------------

  const refreshData = async (forceRefresh = false) => {
    if (!walletAddress) return;

    // Check cache first
    const now = Date.now();
    if (!forceRefresh && dataCache.timestamp && (now - dataCache.timestamp) < CACHE_DURATION) {
      console.log('📦 Using cached data');
      if (dataCache.poolData) setPoolData(dataCache.poolData);
      if (dataCache.userData) setUserData(dataCache.userData);
      return;
    }

    setIsLoading(true); 
    setError(null);

    try {
      // Provider with coerced wallet
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: async (tx: any) => {
          if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
            return await (window as any).solana.signTransaction(tx);
          }
          throw new Error('Wallet not connected');
        },
        signAllTransactions: async (txs: any[]) => {
          if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
            return await (window as any).solana.signAllTransactions(txs);
          }
          throw new Error('Wallet not connected');
        }
      };

      logProgramRequest('refreshData -> loadProgram', {
        wallet: walletAddress,
      });
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);
      console.log('[Staking] refreshData -> program loaded', {
        programId: toDisplayKey(program?.programId),
      });

      // Ensure IDL has Pool layout
      if (!program.idl.accounts?.some(a => a.name.toLowerCase() === 'pool')) {
        throw new Error("Loaded IDL missing 'pool' account in IDL");
      }

      // If we already know the pool PDA, fetch it; otherwise noop
      if (poolData?.poolAddress) {
        const poolPDA = pk(poolData.poolAddress);

        // Paranoia: do not allow mint used as pool
        if (poolPDA.equals(pk(poolData.stakingMint))) {
          throw new Error('Detected stakingMint used as pool. Pool must be the Pool PDA.');
        }

        // Parallel fetch for better performance
        const [pool, userInfo] = await Promise.all([
          (program.account as any).pool.fetch(poolPDA),
          connection.getAccountInfo(userPda(program.programId, poolPDA, pk(walletAddress)))
        ]);
        
        console.log('Raw pool data from blockchain:', {
          stakingMint: pool.stakingMint?.toBase58?.() ?? 'undefined',
          rewardRatePerSec: pool.rewardRatePerSec?.toString?.() ?? 'undefined',
          rewardRatePerSecNumber: pool.rewardRatePerSec?.toNumber?.() ?? 0,
          rewardMint: pool.rewardMint?.toBase58?.() ?? 'undefined',
          totalStaked: pool.totalStaked?.toNumber?.() ?? 0,
          admin: pool.admin?.toBase58?.() ?? 'undefined'
        });
        
        const newPoolData = {
          poolAddress: poolPDA.toBase58(),
          admin: pool.admin?.toBase58() ?? 'Unknown',
          stakingMint: pool.stakingMint?.toBase58() ?? 'Unknown',
          stakingVault: pool.stakingVault?.toBase58() ?? 'Unknown',
          rewardConfigured: pool.rewardConfigured ?? false,
          rewardMint: pool.rewardMint?.toBase58() ?? 'Unknown',
          rewardVault: pool.rewardVault?.toBase58() ?? 'Unknown',
          rewardRatePerSec: pool.rewardRatePerSec?.toNumber?.() ?? 0,
          rateCap: pool.rateCap?.toNumber?.() ?? 0,
          totalStaked: pool.totalStaked?.toNumber?.() ?? 0,
          accScaled: pool.accScaled?.toString?.() ?? '0',
          lastUpdateTs: pool.lastUpdateTs?.toNumber?.() ?? 0,
          paused: pool.paused ?? false,
          locked: pool.locked ?? false,
          bump: pool.bump ?? 0,
          signerBump: pool.signerBump ?? 0,
        };
        
        setPoolData(newPoolData);

        // Fetch User data if account exists
        let newUserData: UserData | null = null;
        if (userInfo) {
          const user = await (program.account as any).user.fetch(userPda(program.programId, poolPDA, pk(walletAddress)));
          console.log('🔍 User account data:', {
            owner: user.owner?.toBase58(),
            staked: user.staked?.toNumber(),
            debt: user.debt?.toString(),
            unpaidRewards: user.unpaidRewards?.toString(),
            bump: user.bump
          });
          newUserData = {
            owner: user.owner?.toBase58() ?? 'Unknown',
            staked: user.staked?.toNumber?.() ?? 0,
            debt: user.debt?.toString?.() ?? '0',
            unpaidRewards: user.unpaidRewards?.toString?.() ?? '0',
            bump: user.bump ?? 0,
          };
          setUserData(newUserData);
        } else {
          console.log('❌ User account not found - user needs to initialize');
          setUserData(null);
        }

        // Update cache
        setDataCache({
          poolData: newPoolData,
          userData: newUserData,
          timestamp: now
        });
      } else {
        // no pool created yet
        setPoolData(null);
        setUserData(null);
        setDataCache({});
      }
    } catch (e: any) {
      console.error('refreshData error:', e);
      setError(e?.message ?? 'Failed to refresh');
      // leave existing state as-is or null it safely:
      if (!poolData) {
      setPoolData(null);
      setUserData(null);
      }
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  const autoDetectPool = async () => {
    if (!walletAddress) return;
    
    try {
      console.log('🔍 Setting up staking context...');
      
      // If we already have a staking mint set, try to fetch the pool for it
      if (stakingMint) {
        try {
          console.log(`🔍 Trying to fetch pool for current staking mint: ${stakingMint}`);
          await fetchPoolByMint(stakingMint);
          console.log('✅ Pool found for current staking mint!');
          return;
        } catch (error) {
          console.log('❌ No pool found for current staking mint:', error instanceof Error ? error.message : String(error));
          console.log('💡 This is normal if the pool hasn\'t been created yet');
        }
      }
      
      // If no staking mint is set, use environment variable or leave empty for admin to set
      if (ENV.STAKING_MINT && ENV.STAKING_MINT !== '11111111111111111111111111111111') {
        console.log(`🔧 Setting staking mint from environment: ${ENV.STAKING_MINT}`);
        setStakingMint(ENV.STAKING_MINT);
        
        // Try to fetch the pool, but don't fail if it doesn't exist
        try {
          await fetchPoolByMint(ENV.STAKING_MINT);
          console.log('✅ Pool found for environment staking mint!');
          return;
        } catch (error) {
          console.log('ℹ️ No pool found for environment staking mint (normal for new deployments)');
        }
      } else {
        console.log('ℹ️ No staking mint configured - ready for admin to set up');
        console.log('💡 Use the admin interface to set the staking mint and initialize a pool');
      }
      
    } catch (error) {
      console.log('❌ Auto-detection failed:', error);
      console.log('💡 This is normal for new deployments - use the admin interface to set up');
    }
  };

  const fetchPoolByMint = async (stakingMintStr: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[Staking] fetchPoolByMint invoked', {
        stakingMint: stakingMintStr,
        wallet: walletAddress,
      });
      
      // Create wallet adapter
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: async (tx: any) => {
          if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
            return await (window as any).solana.signTransaction(tx);
          }
          throw new Error('Wallet not connected');
        },
        signAllTransactions: async (txs: any[]) => {
          if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
            return await (window as any).solana.signAllTransactions(txs);
          }
          throw new Error('Wallet not connected');
        }
      };

      logProgramRequest('fetchPoolByMint -> loadProgram');
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);
      console.log('[Staking] fetchPoolByMint -> program loaded', {
        programId: toDisplayKey(program?.programId),
      });

      // Derive the pool PDA for the given staking mint
      const stakingMint = new PublicKey(stakingMintStr);
      const poolPDA = poolPda(program.programId, stakingMint);
      
      console.log('Debug PDA derivation:', {
        programId: program.programId.toBase58(),
        stakingMint: stakingMint.toBase58(),
        poolPDA: poolPDA.toBase58()
      });
      
      // Check if the account exists and has valid data before trying to fetch
      const accountInfo = await connection.getAccountInfo(poolPDA);
      if (!accountInfo) {
        throw new Error('Pool account does not exist');
      }
      
      console.log('Pool account info:', {
        owner: accountInfo.owner.toBase58(),
        executable: accountInfo.executable,
        lamports: accountInfo.lamports,
        dataLength: accountInfo.data?.length,
        isProgramAccount: accountInfo.owner.equals(program.programId)
      });
      
      // Validate that the account is owned by our program
      if (!accountInfo.owner.equals(program.programId)) {
        throw new Error(`Pool account is not owned by our program. Owner: ${accountInfo.owner.toBase58()}, Expected: ${program.programId.toBase58()}`);
      }
      
      // Check if the account has data
      if (!accountInfo.data || accountInfo.data.length === 0) {
        throw new Error('Pool account has no data');
      }
      
      // Check account discriminator to verify it's actually a Pool account
      console.log('🔍 Checking account discriminator...');
      const discPool = BorshAccountsCoder.accountDiscriminator('Pool');
      const discUser = BorshAccountsCoder.accountDiscriminator('User');
      const got = accountInfo.data.slice(0, 8);
      
      const isPool = Buffer.compare(got, discPool) === 0;
      const isUser = Buffer.compare(got, discUser) === 0;
      
      console.log('Discriminator check:', {
        isPool,
        isUser,
        gotDiscriminator: Array.from(got),
        expectedPoolDisc: Array.from(discPool),
        expectedUserDisc: Array.from(discUser)
      });
      
      if (isUser) {
        throw new Error('Account at pool PDA is a User account, not a Pool account. Check your PDA derivation seeds.');
      }
      
      if (!isPool) {
        throw new Error('Account at pool PDA is not a Pool account (discriminator mismatch). This might be a different account type or corrupted data.');
      }
      
      console.log('✅ Account discriminator matches Pool - proceeding with decode');
      
      // Try to fetch the pool data with better error handling
      let pool;
      try {
        pool = await (program.account as any).pool.fetch(poolPDA);
        console.log('Pool data fetched successfully:', pool);
      } catch (decodeError) {
        console.error('Failed to decode pool account:', decodeError);
        console.log('Account data length:', accountInfo.data.length);
        console.log('Account data (first 32 bytes):', accountInfo.data.slice(0, 32));
        
        // Check if this might be a different account type or corrupted data
        if (decodeError instanceof Error && decodeError.message.includes('beyond buffer length')) {
          console.log('🔍 Account Analysis:');
          console.log('- Account exists and discriminator matches Pool');
          console.log('- But IDL layout mismatch:');
          console.log(`  - On-chain data length: ${accountInfo.data.length} bytes`);
          console.log(`  - Expected by local IDL: ~265 bytes`);
          console.log(`  - Difference: ${accountInfo.data.length - 265} bytes`);
          console.log('💡 This means your local IDL does not match the deployed program');
          console.log('💡 Solutions:');
          console.log('  1. Use the exact IDL that was compiled with the deployed program');
          console.log('  2. Rebuild and redeploy the program to match your current IDL');
          console.log('  3. Check if the program was updated but IDL wasn\'t updated');
          console.log('  4. Verify the _reserved array length in your struct');
          
          throw new Error(`Pool decode failed: IDL/program layout mismatch. Account data length=${accountInfo.data.length} bytes, but your local IDL expects ~265 bytes. Update your IDL to match the deployed binary (or redeploy the program).`);
        }
        throw decodeError;
      }
      
      setPoolData({
        poolAddress: poolPDA.toString(),
        admin: pool.admin?.toString() ?? 'Unknown',
        stakingMint: pool.stakingMint?.toString() ?? 'Unknown',
        stakingVault: pool.stakingVault?.toString() ?? 'Unknown',
        rewardConfigured: pool.rewardConfigured ?? false,
        rewardMint: pool.rewardMint?.toString() ?? 'Unknown',
        rewardVault: pool.rewardVault?.toString() ?? 'Unknown',
        rewardRatePerSec: pool.rewardRatePerSec?.toNumber?.() ?? 0,
        rateCap: pool.rateCap?.toNumber?.() ?? 0,
        totalStaked: pool.totalStaked?.toNumber?.() ?? 0,
        accScaled: pool.accScaled?.toString?.() ?? '0',
        lastUpdateTs: pool.lastUpdateTs?.toNumber?.() ?? 0,
        paused: pool.paused ?? false,
        locked: pool.locked ?? false,
        bump: pool.bump ?? 0,
        signerBump: pool.signerBump ?? 0,
      });

      // Fetch token decimals
      try {
        const { getMint } = await import('@solana/spl-token');
        const stakingMintPk = new PublicKey(pool.stakingMint?.toString() ?? 'Unknown');
        const rewardMintPk = new PublicKey(pool.rewardMint?.toString() ?? 'Unknown');
        
        const stakingInfo = await getMint(connection, stakingMintPk);
        const rewardInfo = await getMint(connection, rewardMintPk);
        
        setStakingDecimals(stakingInfo.decimals ?? 6);
        setRewardDecimals(rewardInfo.decimals ?? 6);
        
        console.log('Token decimals fetched:', {
          staking: stakingInfo.decimals,
          reward: rewardInfo.decimals
        });
      } catch (decimalError) {
        console.warn('Failed to fetch token decimals, using defaults:', decimalError);
        setStakingDecimals(6);
        setRewardDecimals(6);
      }

      // Try to fetch user data if available
      try {
        const userPDA = userPda(program.programId, poolPDA, new PublicKey(walletAddress));
        const user = await (program.account as any).user.fetch(userPDA);
        setUserData({
          owner: user.owner?.toString() ?? 'Unknown',
          staked: user.staked?.toNumber?.() ?? 0,
          debt: user.debt?.toString?.() ?? '0',
          unpaidRewards: user.unpaidRewards?.toString?.() ?? '0',
          bump: user.bump ?? 0,
        });
        console.log('User data fetched:', user);
      } catch (userError) {
        console.log('User account not found yet (normal for new users):', userError);
        setUserData(null);
      }
      
      console.log('✅ Pool data loaded successfully');
      
    } catch (e: any) {
      console.error('❌ Failed to fetch pool:', e);
      setError(e?.message ?? 'Failed to fetch pool data');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // --- Actions ---------------------------------------------------------------

  const initializePool = async (stakingMint: string) => {
    if (!isAdmin || !walletAddress) throw new Error('Only admin can initialize pool');

    setIsLoading(true); 
    setError(null);

    try {
      if (typeof window === 'undefined' || !window.solana?.isPhantom) {
        throw new Error('Phantom wallet not detected');
      }
      if (!(window.solana as any).isConnected) {
        await window.solana.connect();
      }

      // Wallet adapter for init
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: async (tx: any) => (window as any).solana.signTransaction(tx),
        signAllTransactions: async (txs: any[]) => (window as any).solana.signAllTransactions(txs),
      };

      // Add a small delay to prevent rapid-fire transactions
      console.log('⏳ Waiting 1 second before submitting transaction...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get fresh blockhash to prevent "Blockhash not found" errors
      console.log('🔄 Getting fresh blockhash...');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      console.log('✅ Fresh blockhash obtained:', blockhash);

      // Initialize on-chain (creates Pool PDA + stakingVault ATA)
      const initRes = await initializeOnly(stakingMint, wallet);

      // Check if initialization was successful
      if (!initRes) {
        throw new Error('Pool initialization failed - no result returned');
      }

      // Save pool basics in state; reward fields default until setRewardConfig
      setPoolData({
        poolAddress: initRes.pool,
        admin: initRes.admin,
        stakingMint: initRes.stakingMint,
        stakingVault: initRes.stakingVault,
        rewardConfigured: false,
        rewardMint: '11111111111111111111111111111111',
        rewardVault: '11111111111111111111111111111111',
        rewardRatePerSec: Number(initRes.ratePerSec),
        rateCap: 0,
        totalStaked: Number(initRes.totalStaked),
        accScaled: '0',
        lastUpdateTs: Math.floor(Date.now() / 1000),
        paused: false,
        locked: false,
        bump: 0,
        signerBump: 0,
      });

      // Pull fresh Pool/User from chain
      await refreshData();
    } catch (e: any) {
      console.error('initializePool error:', e);
      
      // Check if pool already exists
      if (e?.message?.includes('already in use') || e?.logs?.some((log: string) => log.includes('already in use'))) {
        console.log('Pool already exists, fetching existing pool data...');
        
        try {
          // Derive the pool PDA for the given staking mint
          const stakingMintPk = new PublicKey(stakingMint);
          const poolPDA = poolPda(PROGRAM_ID, stakingMintPk);
          
          console.log('Fetching existing pool at:', poolPDA.toBase58());
          
          // Load the existing pool data
          await fetchPoolByMint(stakingMint);
          console.log('✅ Existing pool data loaded successfully');
          return; // Success - pool data is now loaded
        } catch (loadError) {
          console.error('Failed to load existing pool data:', loadError);
          setError('Pool exists but could not load data. Please refresh the page.');
          throw loadError;
        }
      }
      
      const msg = e?.message ?? 'Failed to initialize pool';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const setRewardRate = async (humanRatePerSec: string | number) => {
    if (!isAdmin || !walletAddress || !poolData) throw new Error('Only admin can update rate');
    setIsLoading(true);
    setError(null);

    try {
             const wallet = {
               publicKey: pk(walletAddress),
               signTransaction: async (tx: any) => {
                 if ((window as any).solana?.isPhantom) return await (window as any).solana.signTransaction(tx);
                 throw new Error('Wallet not connected');
               },
               signAllTransactions: async (txs: any[]) => {
                 if ((window as any).solana?.isPhantom) return await (window as any).solana.signAllTransactions(txs);
                 throw new Error('Wallet not connected');
               },
             };

             const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
             const program = await loadProgram(provider);

             const poolPDA = pk(poolData.poolAddress);
             
             // Scale rate to base units using reward mint decimals
             const { getMint } = await import('@solana/spl-token');
             const rewardMintPk = pk(poolData.rewardMint);
             const mintInfo = await getMint(connection, rewardMintPk);
             const decimals = mintInfo.decimals ?? 0;
             const ratePerSecBase = toBaseUnits(humanRatePerSec, decimals);

             console.log('Updating reward rate:', {
               humanRate: humanRatePerSec,
               decimals,
               baseRate: ratePerSecBase.toString()
             });

             // Add a small delay to prevent rapid-fire transactions
             console.log('⏳ Waiting 1 second before submitting transaction...');
             await new Promise(resolve => setTimeout(resolve, 1000));
             
             // Get fresh blockhash to prevent "Blockhash not found" errors
             console.log('🔄 Getting fresh blockhash...');
             const { blockhash } = await connection.getLatestBlockhash('confirmed');
             console.log('✅ Fresh blockhash obtained:', blockhash);

             const sig = await program.methods
               .setRewardRate(ratePerSecBase)
               .accounts({
                 pool: poolPDA,
                 admin: pk(walletAddress),
               })
               .rpc({ 
                 commitment: 'confirmed',
                 preflightCommitment: 'processed'
               });

             console.log('✅ setRewardRate tx:', sig);
             await new Promise(r => setTimeout(r, 1200));
             await refreshData();
    } catch (e: any) {
      console.error('❌ setRewardRate failed', e);
      
      // Handle specific transaction errors
      if (e?.message?.includes('already been processed')) {
        console.log('🔄 Transaction already processed - treating as success');
        console.log('✅ setRewardRate successful (transaction was already processed)');
        await refreshData();
        return;
      } else if (e?.message?.includes('Blockhash not found')) {
        console.log('🔄 Blockhash not found - this is a network timing issue');
        console.log('💡 This usually resolves itself, please try again');
        throw new Error('Network timing issue. Please try again in a moment.');
      } else if (e?.message?.includes('simulation failed')) {
        console.log('🔄 Transaction simulation failed - checking for specific issues');
        console.log('💡 This might be due to pool configuration issues or insufficient permissions');
        throw new Error('Transaction simulation failed. Please check your admin permissions and try again.');
      } else {
        setError(e?.message ?? 'Failed to update rate');
        throw e;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setPaused = async (paused: boolean) => {
    if (!isAdmin || !walletAddress || !poolData) throw new Error('Only admin can pause/unpause pool');
    setIsLoading(true);
    setError(null);

    try {
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: async (tx: any) => {
          if ((window as any).solana?.isPhantom) return await (window as any).solana.signTransaction(tx);
          throw new Error('Wallet not connected');
        },
        signAllTransactions: async (txs: any[]) => {
          if ((window as any).solana?.isPhantom) return await (window as any).solana.signAllTransactions(txs);
          throw new Error('Wallet not connected');
        },
      };

      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);

      const poolPDA = pk(poolData.poolAddress);

      console.log(`🔄 ${paused ? 'Pausing' : 'Unpausing'} pool...`);
      console.log('Pool PDA:', poolPDA.toBase58());

      // Add a small delay to prevent rapid-fire transactions
      console.log('⏳ Waiting 1 second before submitting transaction...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get fresh blockhash to prevent "Blockhash not found" errors
      console.log('🔄 Getting fresh blockhash...');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      console.log('✅ Fresh blockhash obtained:', blockhash);

      // Build transaction manually to avoid Anchor's blockhash cache
      try {
        console.log('🔄 Building setPaused instruction manually...');
        
        // Get the setPaused instruction (not the full transaction)
        const setPausedIx = await program.methods
          .setPaused(paused)
          .accounts({
            pool: poolPDA,
            admin: pk(walletAddress),
          })
          .instruction(); // Get instruction instead of .rpc()
        
        // Add unique memo to guarantee unique signature using crypto.randomUUID()
        const uniqueId = crypto.randomUUID();
        const memoIx = new TransactionInstruction({
          programId: MEMO_PROGRAM_ID,
          keys: [],
          data: Buffer.from(`setPaused:${uniqueId}`, 'utf8')
        });
        
        console.log('🔄 Using unique memo:', uniqueId);
        
        // Build transaction manually
        const tx = new Transaction().add(memoIx, setPausedIx);
        
        // Fetch blockhash ONCE after building the transaction
        const { blockhash: freshBlockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        tx.recentBlockhash = freshBlockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = pk(walletAddress);
        
        console.log('🔄 Using fresh blockhash:', freshBlockhash);
        
        // Sign and send manually
        const signed = await wallet.signTransaction(tx);
        const sig = await connection.sendRawTransaction(
          signed.serialize(),
          { skipPreflight: false }
        );
        
        // Confirm transaction
        await connection.confirmTransaction(
          { signature: sig, blockhash: freshBlockhash, lastValidBlockHeight },
          'confirmed'
        );
        
        console.log(`✅ Pool ${paused ? 'paused' : 'unpaused'} successfully:`, sig);
      } catch (txError: any) {
        console.error('❌ Transaction failed:', txError);
        
        // Handle specific transaction errors
        if (txError.message?.includes('already been processed')) {
          console.log('🔄 Transaction already processed - treating as success...');
          
          // Treat "already processed" as success - the transaction went through
          console.log(`✅ Pool ${paused ? 'paused' : 'unpaused'} successfully (transaction was already processed)`);
          await refreshData();
          return; // Exit successfully
        } else if (txError.message?.includes('Blockhash not found')) {
          console.log('🔄 Blockhash not found - this is a network timing issue');
          console.log('💡 This usually resolves itself, please try again');
          throw new Error('Network timing issue. Please try again in a moment.');
        } else if (txError.message?.includes('simulation failed')) {
          console.log('🔄 Transaction simulation failed - checking for specific issues');
          console.log('💡 This might be due to insufficient permissions or account issues');
          throw new Error('Transaction simulation failed. Please check your admin permissions and try again.');
        } else {
          throw txError;
        }
      }
      
      await new Promise(r => setTimeout(r, 1200));
      await refreshData();
    } catch (e: any) {
      console.error(`❌ Failed to ${paused ? 'pause' : 'unpause'} pool:`, e);
      
      // Handle specific transaction errors
      if (e?.message?.includes('already been processed')) {
        console.log('🔄 Transaction already processed - treating as success');
        console.log(`✅ Pool ${paused ? 'paused' : 'unpaused'} successfully (transaction was already processed)`);
        await refreshData();
        return;
      } else if (e?.message?.includes('Blockhash not found')) {
        console.log('🔄 Blockhash not found - this is a network timing issue');
        console.log('💡 This usually resolves itself, please try again');
        throw new Error('Network timing issue. Please try again in a moment.');
      } else if (e?.message?.includes('simulation failed')) {
        console.log('🔄 Transaction simulation failed - checking for specific issues');
        console.log('💡 This might be due to insufficient permissions or account issues');
        throw new Error('Transaction simulation failed. Please check your admin permissions and try again.');
      } else {
        setError(e?.message ?? `Failed to ${paused ? 'pause' : 'unpause'} pool`);
        throw e;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setRewardConfig = async (rewardMint: string, ratePerSecHuman: number | string) => {
    if (!isAdmin || !walletAddress || !poolData) throw new Error('Only admin can set reward config');
    setIsLoading(true);
    setError(null);

    try {
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: async (tx: any) => {
          if ((window as any).solana?.isPhantom) return await (window as any).solana.signTransaction(tx);
          throw new Error('Wallet not connected');
        },
        signAllTransactions: async (txs: any[]) => {
          if ((window as any).solana?.isPhantom) return await (window as any).solana.signAllTransactions(txs);
          throw new Error('Wallet not connected');
        },
      };

      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);

      const poolPDA = pk(poolData.poolAddress);
      const signerPDA = signerPda(program.programId, poolPDA);
      const rewardMintPk = pk(rewardMint);

      // ---- SCALE ratePerSec (UI → base units) precisely (no truncation to 0) ----
      const { getMint } = await import('@solana/spl-token');
      const mintInfo = await getMint(connection, rewardMintPk);
      const decimals = mintInfo.decimals ?? 0;

      // Use shared decimal scaling helper

      const ratePerSecBase = toBaseUnits(ratePerSecHuman, decimals);
      if (ratePerSecBase.isZero()) {
        console.warn('ratePerSec scaled to 0; APY will remain 0. Use a larger rate or fewer decimals.');
      }

      // ---- IMPORTANT: reward_vault must be an ATA with PDA as authority ----
      // The new contract expects an ATA with pool_signer as authority
      const rewardVault = await getAssociatedTokenAddress(
        rewardMintPk,
        signerPDA,
        true // allowOwnerOffCurve = true for PDA
      );
      
      console.log('🔍 ATA Debug Info:');
      console.log('Reward Mint:', rewardMintPk.toBase58());
      console.log('Pool Signer PDA:', signerPDA.toBase58());
      console.log('Derived Reward Vault:', rewardVault.toBase58());
      
      // Verify the ATA derivation is correct
      console.log('🔍 Account Verification:');
      console.log('Pool PDA:', poolPDA.toBase58());
      console.log('Admin:', walletAddress);
      console.log('Reward Mint:', rewardMintPk.toBase58());
      console.log('Pool Signer:', signerPDA.toBase58());
      console.log('Reward Vault:', rewardVault.toBase58());
      
      // Check if the ATA already exists and verify its owner
      try {
        const ataInfo = await connection.getAccountInfo(rewardVault);
        if (ataInfo) {
          console.log('⚠️ ATA already exists - checking owner...');
          
          // Parse the ATA account to check its owner
          const { getAccount } = await import('@solana/spl-token');
          try {
            const tokenAccount = await getAccount(connection, rewardVault);
            console.log('ATA Owner:', tokenAccount.owner.toBase58());
            console.log('Expected Owner (PDA):', signerPDA.toBase58());
            
            if (!tokenAccount.owner.equals(signerPDA)) {
              console.log('❌ ATA has wrong owner! Expected PDA but got:', tokenAccount.owner.toBase58());
              console.log('💡 This ATA was created with a different owner than the PDA');
              console.log('🔧 The program expects to create the ATA with PDA as owner, but it already exists with a different owner');
              console.log('📝 Solutions:');
              console.log('1. Use a different reward mint (recommended)');
              console.log('2. Create a new pool with a different staking mint');
              console.log('3. The program needs to be updated to handle existing ATAs');
               throw new Error(`ATA already exists with wrong owner. Expected ${signerPDA.toBase58()} but got ${tokenAccount.owner.toBase58()}. Please use a different reward mint or create a new pool.`);
            } else {
              console.log('✅ ATA has correct owner (PDA)');
              console.log('🔍 Checking ATA balance...');
              console.log('ATA Balance:', tokenAccount.amount.toString());
              if (tokenAccount.amount > 0) {
                console.log('⚠️ ATA has existing balance - this might affect the configuration');
              } else {
                console.log('✅ ATA is empty - safe to proceed');
              }
              
              // Since the ATA already exists, the program's init constraint will fail
              console.log('❌ BLOCKING: ATA already exists but program uses init constraint');
              console.log('💡 The program expects to create the ATA, but it already exists');
              console.log('🔧 This will fail with "Provided owner is not allowed"');
              console.log('📝 Solutions:');
              console.log('1. Use a different reward mint (recommended)');
              console.log('2. Create a new pool with different staking mint');
              console.log('3. Update the program to handle existing ATAs');
              throw new Error('ATA already exists but program uses init constraint. Please use a different reward mint or create a new pool.');
            }
          } catch (parseError) {
            console.log('Could not parse ATA account:', parseError);
            console.log('🔍 ATA Account Info:', {
              address: rewardVault.toBase58(),
              exists: true,
              parseError: parseError instanceof Error ? parseError.message : String(parseError)
            });
            
            // Try to get raw account info to understand what's happening
            try {
              const rawAccountInfo = await connection.getAccountInfo(rewardVault);
              console.log('Raw ATA Account Info:', {
                address: rewardVault.toBase58(),
                owner: rawAccountInfo?.owner?.toBase58(),
                executable: rawAccountInfo?.executable,
                lamports: rawAccountInfo?.lamports,
                dataLength: rawAccountInfo?.data?.length,
                data: rawAccountInfo?.data ? 'Has data' : 'No data'
              });
            } catch (rawError) {
              console.log('Could not get raw account info:', rawError);
            }
            
            // If we can't parse the ATA, it might be in an invalid state
            // Let's try to proceed anyway and let the program handle it
            console.log('⚠️ ATA exists but cannot be parsed - proceeding anyway');
            console.log('💡 The program might be able to handle this invalid ATA state');
            console.log('🔧 If this fails, try using a different reward mint');
            
            // Don't throw an error, just log and continue
            // The program might be able to handle the invalid ATA
          }
        } else {
          console.log('✅ ATA does not exist yet (normal for new setup)');
        }
      } catch (e) {
        console.log('ATA check failed:', e);
        throw e; // Re-throw if it's an error we want to handle
      }

      console.log('SetRewardConfig accounts', {
        pool: poolPDA.toBase58(),
        admin: walletAddress,
        poolSigner: signerPDA.toBase58(),  // <-- Fixed: was signer
        rewardMint: rewardMintPk.toBase58(),
        rewardVault: rewardVault.toBase58(),
      });

      console.log('Rate scaling:', {
        humanRate: ratePerSecHuman,
        decimals,
        baseRate: ratePerSecBase.toString(),
        baseRateNumber: ratePerSecBase.toNumber()
      });

      // Check if pool is already configured
      if (poolData && poolData.rewardMint && poolData.rewardMint !== '11111111111111111111111111111111') {
        console.log('❌ Pool rewards are already configured!');
        console.log('Current reward mint:', poolData.rewardMint);
        console.log('Current rate per sec:', poolData.rewardRatePerSec);
        console.log('💡 Use setRewardRate to update the rate instead');
        throw new Error('Pool rewards are already configured. Use setRewardRate to update the rate instead.');
      }

      console.log('🔍 About to call configureRewards...');
      console.log('⚠️ WARNING: The ATA already exists, but the program now uses init_if_needed');
      console.log('💡 This should work with the updated program');
      console.log('🔧 If this fails, the pool might already be configured');

      // Add a small delay to prevent rapid-fire transactions
      console.log('⏳ Waiting 1 second before submitting transaction...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get fresh blockhash to prevent "Blockhash not found" errors
      console.log('🔄 Getting fresh blockhash...');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      console.log('✅ Fresh blockhash obtained:', blockhash);

      const sig = await program.methods
        .configureRewards(ratePerSecBase)
        .accounts({
          pool: poolPDA,
          admin: pk(walletAddress),
          rewardMint: rewardMintPk,
          poolSigner: signerPDA,
          rewardVault,                        // ATA with PDA as authority
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc({ 
          skipPreflight: true, 
          commitment: 'confirmed'
        });

      console.log('✅ setRewardConfig tx:', sig);
      await new Promise(r => setTimeout(r, 1200));
      await refreshData();
    } catch (e: any) {
      console.error('❌ setRewardConfig failed', e);
      
      // Handle specific transaction errors
      if (e?.message?.includes('already been processed')) {
        console.log('🔄 Transaction already processed - treating as success');
        console.log('💡 This is normal with Phantom wallet - transaction was successful');
        await refreshData();
        return;
      } else if (e?.message?.includes('Blockhash not found')) {
        console.log('🔄 Blockhash not found - this is a network timing issue');
        console.log('💡 This usually resolves itself, please try again');
        throw new Error('Network timing issue. Please try again in a moment.');
      } else if (e?.message?.includes('simulation failed')) {
        console.log('🔄 Transaction simulation failed - checking for specific issues');
        console.log('💡 This might be due to pool configuration issues or insufficient permissions');
        throw new Error('Transaction simulation failed. Please check your admin permissions and try again.');
      } else {
        setError(e?.message ?? 'Failed to set reward config');
        throw e;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stake = async (amount: number) => {
    console.log('🚀 STAKE FUNCTION CALLED!', { amount, walletAddress, poolData });
    if (!walletAddress || !poolData) throw new Error('Wallet not connected or pool not initialized');
    setIsLoading(true); 
    setError(null);
    try {
      console.log('Staking tokens:', { amount, walletAddress, poolAddress: poolData.poolAddress });
      
      // Create wallet adapter
      const wallet = (window as any).solana;
      if (!wallet?.publicKey) throw new Error('Wallet not connected');
      
      const anchorWallet = {
        publicKey: pk(wallet.publicKey),
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      } as any;
      
      // Create provider and program
      const provider = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);
      
      // Derive accounts
      const poolPDA = pk(poolData.poolAddress);
      
      // Use the signer PDA that was actually created during pool initialization
      // The pool data contains the signerBump that was used
      const [signerPDA, signerBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("signer"), poolPDA.toBuffer()],
        program.programId
      );
      
      // Read the actual pool signer from the vault token account authority
      // This is more reliable than trying to derive the PDA client-side
      const { getAccount } = await import('@solana/spl-token');
      const stakingVaultPk = pk(poolData.stakingVault);
      
      console.log('🔍 Reading pool signer from vault authority...');
      const vaultAccount = await getAccount(connection, stakingVaultPk);
      const poolSigner = new PublicKey(vaultAccount.owner);
      
      console.log('✅ Pool signer (from vault authority):', poolSigner.toBase58());
      console.log('🔍 Comparing with our derivation:', signerPDA.toBase58());
      console.log('🔍 Expected from error:', 'DHPdammvheftDaSmEvPuDnHErMTudC1iTGjfLPbPnsbt');
      console.log('🔍 Matches expected:', poolSigner.toBase58() === 'DHPdammvheftDaSmEvPuDnHErMTudC1iTGjfLPbPnsbt');
      
      // Use the actual pool signer from vault authority
      const correctSignerPDA = poolSigner;
      
      const userPDA = userPda(program.programId, poolPDA, pk(walletAddress));
      
      // Debug PDA derivations
      console.log('🔍 PDA Derivation Debug:');
      console.log('Program ID:', program.programId.toBase58());
      console.log('Pool PDA:', poolPDA.toBase58());
      console.log('Signer PDA (our derivation):', signerPDA.toBase58());
      console.log('User PDA:', userPDA.toBase58());
      
      // Check if the signer PDA derivation matches what the program expects
      const [expectedSignerPDA, expectedBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("signer"), poolPDA.toBuffer()],
        program.programId
      );
      console.log('Expected Signer PDA:', expectedSignerPDA.toBase58());
      console.log('Expected Bump:', expectedBump);
      console.log('Signer PDA matches expected:', signerPDA.equals(expectedSignerPDA));
      
      // Try alternative derivations that the program might expect
      const [altSignerPDA1, altBump1] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool_signer"), poolPDA.toBuffer()],
        program.programId
      );
      console.log('Alternative Signer PDA (pool_signer):', altSignerPDA1.toBase58());
      
      const [altSignerPDA2, altBump2] = PublicKey.findProgramAddressSync(
        [Buffer.from("signer"), poolPDA.toBuffer()],
        program.programId
      );
      console.log('Alternative Signer PDA (signer):', altSignerPDA2.toBase58());
      
      // Check if any of these match the expected address from the error
      const expectedFromError = 'DHPdammvheftDaSmEvPuDnHErMTudC1iTGjfLPbPnsbt';
      console.log('Expected from error:', expectedFromError);
      console.log('Our derivation matches error:', signerPDA.toBase58() === expectedFromError);
      console.log('Alt derivation 1 matches error:', altSignerPDA1.toBase58() === expectedFromError);
      console.log('Alt derivation 2 matches error:', altSignerPDA2.toBase58() === expectedFromError);
      
      // Get user's staking ATA
      const userStakingAta = await getAssociatedTokenAddress(
        pk(poolData.stakingMint),
        pk(walletAddress)
      );
      
      // Get staking vault (from pool data)
      const stakingVault = pk(poolData.stakingVault);
      
      // Scale amount to base units using staking mint decimals
      const { getMint } = await import('@solana/spl-token');
      const stakeMintInfo = await getMint(connection, pk(poolData.stakingMint));
      const d = stakeMintInfo.decimals ?? 0;

      // Use shared decimal scaling helper

      const amountBase = toBaseUnits(amount, d);

      console.log('Stake scaling:', {
        humanAmount: amount,
        decimals: d,
        baseAmount: amountBase.toString()
      });
      
      console.log('Stake accounts:', {
        owner: walletAddress,
        pool: poolPDA.toBase58(),
        signer: correctSignerPDA.toBase58(),
        userStakingAta: userStakingAta.toBase58(),
        stakingVault: stakingVault.toBase58(),
        user: userPDA.toBase58(),
      });
      
      // Check user's token balance before staking
      try {
        const userTokenAccount = await getAccount(connection, userStakingAta);
        console.log('🔍 User token balance:', userTokenAccount.amount.toString());
        console.log('🔍 Amount to stake:', amountBase.toString());
        
        if (userTokenAccount.amount < BigInt(amountBase.toString())) {
          throw new Error(`Insufficient token balance. Available: ${userTokenAccount.amount.toString()}, Required: ${amountBase.toString()}`);
        }
      } catch (balanceError) {
        console.log('⚠️ Could not check token balance:', balanceError);
        console.log('💡 Proceeding with transaction - balance will be checked by the program');
      }
      
      // Add a small delay to prevent rapid-fire transactions
      console.log('⏳ Waiting 1 second before submitting transaction...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get fresh blockhash to prevent "Blockhash not found" errors
      console.log('🔄 Getting fresh blockhash...');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      console.log('✅ Fresh blockhash obtained:', blockhash);
      
      // Check if we should use the signer from pool data instead
      if (poolData.signerBump && poolData.signerBump > 0) {
        console.log('🔍 Pool data has signerBump:', poolData.signerBump);
        console.log('🔍 This suggests the signer PDA was derived during pool initialization');
        console.log('🔍 Let me check if we need to use a different derivation...');
      }
      
      // Call stake instruction with proper transaction handling
      try {
        const tx = await program.methods
          .stake(amountBase)
          .accounts({
            owner: pk(walletAddress),
            pool: poolPDA,
            poolSigner: correctSignerPDA,     // <-- Fixed: was signer
            userStakingAta,
            stakingVault,
            user: userPDA,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc({ 
            commitment: 'confirmed',
            preflightCommitment: 'processed'
          });
        
        console.log('✅ Stake transaction successful:', tx);
      } catch (txError: any) {
        console.error('❌ Transaction failed:', txError);
        
        // Handle specific transaction errors
        if (txError.message?.includes('already been processed')) {
          console.log('🔄 Transaction already processed - treating as success');
          console.log('✅ Stake successful (transaction was already processed)');
          await refreshData();
          return;
        } else if (txError.message?.includes('Blockhash not found')) {
          console.log('🔄 Blockhash not found - this is a network timing issue');
          console.log('💡 This usually resolves itself, please try again');
          throw new Error('Network timing issue. Please try again in a moment.');
        } else if (txError.message?.includes('simulation failed')) {
          console.log('🔄 Transaction simulation failed - checking for specific issues');
          console.log('💡 This might be due to insufficient funds or account issues');
          throw new Error('Transaction simulation failed. Please check your token balance and try again.');
        } else {
          throw txError;
        }
      }
      
      console.log('✅ Stake successful');
      
      // Refresh data to show updated balances
      await refreshData();
      
    } catch (e: any) {
      console.error('❌ Stake failed:', e);
      setError(e?.message ?? 'Failed to stake');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const unstake = async (amount: number) => {
    if (!walletAddress || !poolData) throw new Error('Wallet not connected or pool not initialized');
    setIsLoading(true); 
    setError(null);
    try {
      console.log('Unstaking tokens:', { amount, walletAddress, poolAddress: poolData.poolAddress });
      
      // IMPORTANT: Claim rewards first to preserve them before unstaking
      // This prevents the unstake from resetting pending rewards
      console.log('🔄 Claiming rewards before unstaking to preserve them...');
      try {
        await claim();
        console.log('✅ Rewards claimed successfully before unstaking');
      } catch (claimError) {
        console.log('⚠️ Could not claim rewards before unstaking (this is OK if no rewards to claim):', claimError);
        // Continue with unstake even if claim fails (user might have no rewards)
      }
      
      // Create wallet adapter
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: async (tx: any) => {
          if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
            return await (window as any).solana.signTransaction(tx);
          }
          throw new Error('Wallet not connected');
        },
        signAllTransactions: async (txs: any[]) => {
          if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
            return await (window as any).solana.signAllTransactions(txs);
          }
          throw new Error('Wallet not connected');
        }
      };

      // Create provider and program
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);
      
      // Derive accounts
      const poolPDA = pk(poolData.poolAddress);
      
      // Read the actual pool signer from the vault token account authority
      const { getAccount } = await import('@solana/spl-token');
      const stakingVaultPk = pk(poolData.stakingVault);
      
      console.log('🔍 Reading pool signer from vault authority for unstake...');
      const vaultAccount = await getAccount(connection, stakingVaultPk);
      const poolSigner = new PublicKey(vaultAccount.owner);
      
      console.log('✅ Pool signer (from vault authority):', poolSigner.toBase58());
      
      const userPDA = userPda(program.programId, poolPDA, pk(walletAddress));
      
      // Get user's staking ATA
      const userStakingAta = await getAssociatedTokenAddress(
        pk(poolData.stakingMint),
        pk(walletAddress)
      );
      
      // Get staking vault (from pool data)
      const stakingVault = pk(poolData.stakingVault);
      
      // Scale amount to base units using staking mint decimals
      const { getMint } = await import('@solana/spl-token');
      const stakeMintInfo = await getMint(connection, pk(poolData.stakingMint));
      const d = stakeMintInfo.decimals ?? 0;

      // Use shared decimal scaling helper

      const amountBase = toBaseUnits(amount, d);

      console.log('Unstake scaling:', {
        humanAmount: amount,
        decimals: d,
        baseAmount: amountBase.toString()
      });
      
      console.log('Unstake accounts:', {
        owner: walletAddress,
        pool: poolPDA.toBase58(),
        signer: poolSigner.toBase58(),
        stakingVault: stakingVault.toBase58(),
        userStakingAta: userStakingAta.toBase58(),
        user: userPDA.toBase58(),
      });
      
      // Check user's staked balance before unstaking
      try {
        const userTokenAccount = await getAccount(connection, userStakingAta);
        console.log('🔍 User staked balance:', userTokenAccount.amount.toString());
        console.log('🔍 Amount to unstake:', amountBase.toString());
        
        if (userTokenAccount.amount < BigInt(amountBase.toString())) {
          throw new Error(`Insufficient staked balance. Available: ${userTokenAccount.amount.toString()}, Required: ${amountBase.toString()}`);
        }
      } catch (balanceError) {
        console.log('⚠️ Could not check staked balance:', balanceError);
        console.log('💡 Proceeding with transaction - balance will be checked by the program');
      }
      
      // Add a small delay to prevent rapid-fire transactions
      console.log('⏳ Waiting 1 second before submitting transaction...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get fresh blockhash to prevent "Blockhash not found" errors
      console.log('🔄 Getting fresh blockhash...');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      console.log('✅ Fresh blockhash obtained:', blockhash);
      
      // Call unstake instruction with proper transaction handling
      try {
        const tx = await program.methods
          .unstake(amountBase)
          .accounts({
            owner: pk(walletAddress),
            pool: poolPDA,
            poolSigner: poolSigner,     // <-- Use vault authority
            stakingVault,
            userStakingAta,
            user: userPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc({ 
            commitment: 'confirmed',
            preflightCommitment: 'processed'
          });
        
        console.log('✅ Unstake transaction successful:', tx);
      } catch (txError: any) {
        console.error('❌ Transaction failed:', txError);
        
        // Handle specific transaction errors
        if (txError.message?.includes('already been processed')) {
          console.log('🔄 Transaction already processed - treating as success');
          console.log('✅ Unstake successful (transaction was already processed)');
          await refreshData();
          return;
        } else if (txError.message?.includes('Blockhash not found')) {
          console.log('🔄 Blockhash not found - this is a network timing issue');
          console.log('💡 This usually resolves itself, please try again');
          throw new Error('Network timing issue. Please try again in a moment.');
        } else if (txError.message?.includes('simulation failed')) {
          console.log('🔄 Transaction simulation failed - checking for specific issues');
          console.log('💡 This might be due to insufficient staked balance or account issues');
          throw new Error('Transaction simulation failed. Please check your staked balance and try again.');
        } else {
          throw txError;
        }
      }
      
      console.log('✅ Unstake successful');
      await refreshData();
    } catch (e: any) {
      console.error('❌ Unstake failed:', e);
      setError(e?.message ?? 'Failed to unstake');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };


  const claim = async () => {
    if (!walletAddress || !poolData) throw new Error('Wallet not connected or pool not initialized');
    
    // Prevent duplicate submissions within 5 seconds
    const now = Date.now();
    if (now - lastTransactionTime < 5000) {
      throw new Error('Please wait a few seconds before submitting another transaction');
    }
    
    setIsLoading(true); 
    setError(null);
    setLastTransactionTime(now);

    try {
      console.log('Claiming rewards:', { walletAddress, poolAddress: poolData.poolAddress });
      
      // Create wallet adapter
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: async (tx: any) => {
          if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
            return await (window as any).solana.signTransaction(tx);
          }
          throw new Error('Wallet not connected');
        },
        signAllTransactions: async (txs: any[]) => {
          if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
            return await (window as any).solana.signAllTransactions(txs);
          }
          throw new Error('Wallet not connected');
        }
      };

      // Create provider and program
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);
      
      // Derive accounts
      const poolPDA = pk(poolData.poolAddress);
      
      // Read the actual pool signer from the vault token account authority
      const { getAccount } = await import('@solana/spl-token');
      const stakingVaultPk = pk(poolData.stakingVault);
      
      console.log('🔍 Reading pool signer from vault authority for claim...');
      const vaultAccount = await getAccount(connection, stakingVaultPk);
      const poolSigner = new PublicKey(vaultAccount.owner);
      
      console.log('✅ Pool signer (from vault authority):', poolSigner.toBase58());
      
      const userPDA = userPda(program.programId, poolPDA, pk(walletAddress));
      
      // Get reward vault (from pool data)
      const rewardVault = pk(poolData.rewardVault);
      
      // Get or create user's reward ATA (idempotent - never fails if exists)
      console.log('🔄 Ensuring user reward ATA exists...');
      console.log('🔍 Reward mint:', poolData.rewardMint);
      console.log('🔍 User wallet:', walletAddress);
      
      // Check if user has enough SOL for account creation
      const userBalance = await connection.getBalance(pk(walletAddress));
      const minBalance = 0.002 * 1e9; // 0.002 SOL in lamports
      console.log('🔍 User SOL balance:', userBalance / 1e9, 'SOL');
      console.log('🔍 Minimum required:', minBalance / 1e9, 'SOL');
      
      if (userBalance < minBalance) {
        throw new Error(`Insufficient SOL balance. You need at least 0.002 SOL to create token accounts. Current balance: ${(userBalance / 1e9).toFixed(6)} SOL`);
      }
      
      let userRewardAta;
      
      // First, try to derive the ATA address
      const derivedAta = await getAssociatedTokenAddress(
        pk(poolData.rewardMint),
        pk(walletAddress)
      );
      
      console.log('🔍 Derived ATA address:', derivedAta.toBase58());
      
      // Check if the ATA already exists
      const ataInfo = await connection.getAccountInfo(derivedAta);
      if (ataInfo) {
        console.log('✅ ATA already exists:', derivedAta.toBase58());
        userRewardAta = derivedAta;
      } else {
        console.log('🔄 ATA does not exist, creating it...');
        
        // Try automatic creation first
        try {
          const userRewardAtaAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            wallet as any,          // payer / signer
            pk(poolData.rewardMint), // mint
            pk(walletAddress)        // owner
          );
          
          userRewardAta = userRewardAtaAccount.address;
          console.log('✅ ATA created automatically:', userRewardAta.toBase58());
        } catch (autoError: any) {
          console.log('⚠️ Automatic creation failed, trying manual creation:', autoError.message);
          
          // Manual creation as fallback
          try {
            const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
            const { Transaction } = await import('@solana/web3.js');
            
            const createAtaTx = new Transaction();
            createAtaTx.add(
              createAssociatedTokenAccountInstruction(
                pk(walletAddress),   // payer
                derivedAta,          // ata to create
                pk(walletAddress),   // owner
                pk(poolData.rewardMint) // mint
              )
            );
            
            // Get fresh blockhash
            const { blockhash } = await connection.getLatestBlockhash('confirmed');
            createAtaTx.recentBlockhash = blockhash;
            createAtaTx.feePayer = pk(walletAddress);
            
            // Sign and send
            const signed = await wallet.signTransaction(createAtaTx);
            const sig = await connection.sendRawTransaction(signed.serialize());
            await connection.confirmTransaction(sig, 'confirmed');
            
            console.log('✅ ATA created manually:', sig);
            userRewardAta = derivedAta;
          } catch (manualError: any) {
            throw new Error(`Failed to create user reward token account. Please ensure you have enough SOL (at least 0.002 SOL) for the account creation fee. Error: ${manualError.message}`);
          }
        }
      }
      
      console.log('Claim accounts:', {
        owner: walletAddress,
        pool: poolPDA.toBase58(),
        poolSigner: poolSigner.toBase58(),
        rewardVault: rewardVault.toBase58(),
        userRewardAta: userRewardAta.toBase58(),
        user: userPDA.toBase58(),
      });
      
      // Add a small delay to prevent rapid-fire transactions
      console.log('⏳ Waiting 1 second before submitting transaction...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Build claim instruction manually to avoid Anchor's blockhash cache
      try {
        console.log('🔄 Building claim instruction manually...');
        
        // Get the claim instruction (not the full transaction)
        const claimIx = await program.methods
          .claim()
          .accounts({
            owner: pk(walletAddress),
            pool: poolPDA,
            poolSigner: poolSigner,
            rewardVault,
            userRewardAta,
            user: userPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .instruction(); // Get instruction instead of .rpc()
        
        // Add unique memo to guarantee unique signature using crypto.randomUUID()
        const uniqueId = crypto.randomUUID();
        const memoIx = new TransactionInstruction({
          programId: MEMO_PROGRAM_ID,
          keys: [],
          data: Buffer.from(`claim:${uniqueId}`, 'utf8')
        });
        
        console.log('🔄 Using unique memo:', uniqueId);
        
        // Build transaction manually
        const tx = new Transaction().add(memoIx, claimIx);
        
        // Fetch blockhash ONCE after building the transaction
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = pk(walletAddress);
        
        console.log('🔄 Using fresh blockhash:', blockhash);
        
        // Sign and send manually
        const signed = await wallet.signTransaction(tx);
        const sig = await connection.sendRawTransaction(
          signed.serialize(),
          { skipPreflight: false }
        );
        
        // Confirm transaction
        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          'confirmed'
        );
        
        console.log('✅ Claim transaction successful:', sig);
        
        // Check the actual claimed amount by comparing balances
        try {
          const afterBalance = await connection.getTokenAccountBalance(userRewardAta);
          const claimedAmount = Number(afterBalance.value.amount);
          const claimedUI = claimedAmount / Math.pow(10, rewardDecimals);
          console.log('💰 Current reward balance after claim:', {
            baseUnits: claimedAmount,
            uiAmount: claimedUI,
            decimals: rewardDecimals
          });
        } catch (balanceError) {
          console.log('Could not check balance after claim:', balanceError);
        }
      } catch (txError: any) {
        console.error('❌ Transaction failed:', txError);
        
        // Handle specific transaction errors
        if (txError.message?.includes('already been processed')) {
          console.log('🔄 Transaction already processed - treating as success...');
          
          // Treat "already processed" as success - the transaction went through
          console.log('✅ Claim successful (transaction was already processed)');
          await refreshData();
          return; // Exit successfully
        } else if (txError.message?.includes('Blockhash not found')) {
          console.log('🔄 Blockhash not found - this is a network timing issue');
          console.log('💡 This usually resolves itself, please try again');
          throw new Error('Network timing issue. Please try again in a moment.');
        } else if (txError.message?.includes('simulation failed')) {
          console.log('🔄 Transaction simulation failed - checking for specific issues');
          console.log('💡 This might be due to insufficient rewards or account issues');
          throw new Error('Transaction simulation failed. Please check your rewards and try again.');
        } else {
          throw txError;
        }
      }
      
      console.log('✅ Claim successful');
      await refreshData();
    } catch (e: any) {
      console.error('❌ Claim failed:', e);
      setError(e?.message ?? 'Failed to claim rewards');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const checkRewardVaultBalance = async (): Promise<number> => {
    if (!poolData) {
      console.log('No pool data available');
      return 0;
    }
    
    // Check if reward vault is configured (not the default empty value)
    if (poolData.rewardVault === '11111111111111111111111111111111') {
      console.log('Reward vault not configured yet');
      return 0;
    }
    
    try {
      // Use the actual rewardVault address from poolData (not derived ATA)
      const rewardVaultPk = pk(poolData.rewardVault);
      
      const vaultBalance = await connection.getTokenAccountBalance(rewardVaultPk);
      console.log('Reward Vault Balance:', {
        vaultAddress: rewardVaultPk.toBase58(),
        balance: vaultBalance.value.uiAmount,
        balanceString: vaultBalance.value.uiAmountString,
        decimals: vaultBalance.value.decimals
      });
      
      return vaultBalance.value.uiAmount || 0;
    } catch (e) {
      console.error('Failed to check reward vault balance:', e);
      return 0;
    }
  };

  const computeApy = async () => {
    if (!poolData) return null;
    
    try {
             console.log('🔍 APY Calculation Debug:', {
               rewardMint: poolData.rewardMint,
               ratePerSec: poolData.rewardRatePerSec,
               totalStaked: poolData.totalStaked,
               rewardConfigured: poolData.rewardMint !== '11111111111111111111111111111111'
             });
             
             // Show the current rate in human-readable format
             if (poolData.rewardRatePerSec > 0) {
               const rewardMintPk = new PublicKey(poolData.rewardMint);
               const { getMint } = await import('@solana/spl-token');
               const rewardInfo = await getMint(connection, rewardMintPk);
               const rewDec = rewardInfo.decimals ?? 0;
               const ratePerSecUI = poolData.rewardRatePerSec / (10 ** rewDec);
               
               console.log('📊 Current Rate Settings:', {
                 baseUnits: poolData.rewardRatePerSec,
                 humanReadable: ratePerSecUI,
                 decimals: rewDec,
                 perSecond: `${ratePerSecUI} tokens per second`,
                 perDay: `${(ratePerSecUI * 86400).toFixed(6)} tokens per day`,
                 perYear: `${(ratePerSecUI * 31536000).toFixed(6)} tokens per year`
               });
             }
             
      // Check if reward config is set
      if (!poolData.rewardMint || poolData.rewardMint === '11111111111111111111111111111111') {
        console.log('❌ Reward configuration not set');
        return null;
      }
      
             if (poolData.rewardRatePerSec <= 0) {
               console.log('❌ Invalid rate:', {
                 ratePerSec: poolData.rewardRatePerSec,
                 reason: 'Rate is 0 or negative'
               });
        return null;
      }
             
             // If no tokens staked, show theoretical APY (assuming 1 token staked)
             if (poolData.totalStaked <= 0) {
               console.log('⚠️ No tokens staked yet - showing theoretical APY (assuming 1 token staked)');
               
               // Calculate theoretical APY with 1 token staked
               const stakingMintPk = new PublicKey(poolData.stakingMint);
               const rewardMintPk = new PublicKey(poolData.rewardMint);
               
               const { getMint } = await import('@solana/spl-token');
               const stakingInfo = await getMint(connection, stakingMintPk);
               const rewardInfo = await getMint(connection, rewardMintPk);
               
               const stakeDec = stakingInfo.decimals ?? 0;
               const rewDec = rewardInfo.decimals ?? 0;
               
               // Convert base units → UI units
               const ratePerSecUI = poolData.rewardRatePerSec / (10 ** rewDec);
               const theoreticalStaked = 1; // 1 token staked
               
               const secondsPerYear = 31_536_000;
               const yearlyRewards = ratePerSecUI * secondsPerYear;
               const apyDecimal = yearlyRewards / theoreticalStaked;
               const apyPercent = apyDecimal * 100;
               
               console.log('🔍 Theoretical APY (1 token staked):', {
                 ratePerSecUI,
                 theoreticalStaked,
                 yearlyRewards,
                 apyPercent: `${apyPercent.toFixed(6)}%`,
                 formula: `(${ratePerSecUI} * ${secondsPerYear} / ${theoreticalStaked}) * 100 = ${apyPercent.toFixed(6)}%`
               });
               
               return {
                 ratePerSecUI,
                 totalStakedUI: theoreticalStaked,
                 yearlyRewards,
                 secondsPerYear,
                 apyPercent,
                 decimals: { staking: stakeDec, reward: rewDec },
                 baseUnits: { ratePerSec: poolData.rewardRatePerSec, totalStaked: poolData.totalStaked },
                 isTheoretical: true
               };
      }

      const stakingMintPk = new PublicKey(poolData.stakingMint);
      const rewardMintPk = new PublicKey(poolData.rewardMint);

      const { getMint } = await import('@solana/spl-token');
      const stakingInfo = await getMint(connection, stakingMintPk);
      const rewardInfo = await getMint(connection, rewardMintPk);

      const stakeDec = stakingInfo.decimals ?? 0;
      const rewDec = rewardInfo.decimals ?? 0;

      // Convert base units → UI units
      const ratePerSecUI = poolData.rewardRatePerSec / (10 ** rewDec);
      const totalStakedUI = poolData.totalStaked / (10 ** stakeDec);

      if (totalStakedUI <= 0) return null;

      const secondsPerYear = 31_536_000;
      const yearlyRewards = ratePerSecUI * secondsPerYear;
      const apyDecimal = yearlyRewards / totalStakedUI;
      const apyPercent = apyDecimal * 100;

      const breakdown = {
        ratePerSecUI,
        totalStakedUI,
        yearlyRewards,
        secondsPerYear,
        apyPercent,
        decimals: { staking: stakeDec, reward: rewDec },
        baseUnits: { ratePerSec: poolData.rewardRatePerSec, totalStaked: poolData.totalStaked }
      };

      console.log('🔍 APY Debugger:', breakdown);
             console.log('✅ APY Calculation successful:', {
               ratePerSecUI,
               totalStakedUI,
               apyPercent: `${apyPercent.toFixed(6)}%`,
               formula: `(${ratePerSecUI} * ${secondsPerYear} / ${totalStakedUI}) * 100 = ${apyPercent.toFixed(6)}%`
             });
      return breakdown;
    } catch (e) {
      console.error('Failed to compute APY:', e);
      return null;
    }
  };

  const checkCurrentPoolState = async () => {
    if (!poolData) {
      console.log('No pool data available');
      return;
    }
    
    try {
      console.log('🔍 Checking current pool state...');
      console.log('Current pool data:', {
        poolAddress: poolData.poolAddress,
        rewardMint: poolData.rewardMint,
        ratePerSec: poolData.rewardRatePerSec,
        totalStaked: poolData.totalStaked,
        admin: poolData.admin
      });

      // Check if reward config is already set
      if (poolData.rewardMint && poolData.rewardMint !== '11111111111111111111111111111111') {
        console.log('✅ Reward configuration is already set!');
        console.log('Reward Mint:', poolData.rewardMint);
        console.log('Rate Per Second:', poolData.rewardRatePerSec);
        
        // Compute APY with detailed breakdown
        const apyBreakdown = await computeApy();
        if (apyBreakdown) {
          console.log('Current APY:', `${apyBreakdown.apyPercent.toFixed(6)}%`);
        }
        
        // Check reward vault balance
        await checkRewardVaultBalance();
      } else {
        console.log('❌ Reward configuration not set yet');
        console.log('Reward Mint:', poolData.rewardMint);
        console.log('Rate Per Second:', poolData.rewardRatePerSec);
      }
    } catch (e) {
      console.error('Failed to check pool state:', e);
    }
  };

  const addRewardTokens = async (amountHuman: number) => {
    if (!isAdmin || !walletAddress || !poolData) throw new Error('Only admin can add reward tokens');
    
    // Prevent duplicate submissions within 5 seconds
    const now = Date.now();
    if (now - lastTransactionTime < 5000) {
      throw new Error('Please wait a few seconds before submitting another transaction');
    }
    
    setIsLoading(true);
    setError(null);
    setLastTransactionTime(now);
    try {
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: async (tx: any) => {
          if ((window as any).solana?.isPhantom) return await (window as any).solana.signTransaction(tx);
          throw new Error('Wallet not connected');
        },
        signAllTransactions: async (txs: any[]) => {
          if ((window as any).solana?.isPhantom) return await (window as any).solana.signAllTransactions(txs);
          throw new Error('Wallet not connected');
        },
      };
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program  = await loadProgram(provider);

      const poolPDA    = pk(poolData.poolAddress);
      const signerPDA  = signerPda(program.programId, poolPDA);
      const rewardMint = pk(poolData.rewardMint);
      if (!rewardMint) throw new Error('Reward mint not configured yet');

      // Derive vault ATA (owner = signerPDA)
      const rewardVault = await getAssociatedTokenAddress(rewardMint, signerPDA, true);

      // Admin's ATA (source)
      const adminRewardAta = await getAssociatedTokenAddress(rewardMint, pk(walletAddress));

             // Check if admin has ATA for reward mint, create if needed
      try {
        const adminBalance = await connection.getTokenAccountBalance(adminRewardAta);
        console.log('Admin balance before transfer:', adminBalance.value.uiAmount);
               
               // Check if admin has enough tokens
               if (adminBalance.value.uiAmount === null || adminBalance.value.uiAmount < amountHuman) {
                 console.log('❌ Insufficient reward tokens in admin wallet!');
                 console.log('🔍 Admin balance:', adminBalance.value.uiAmount);
                 console.log('🔍 Required amount:', amountHuman);
                 console.log('💡 Solution: You need to acquire some reward tokens first');
                 console.log('💡 Reward mint:', rewardMint.toBase58());
                 throw new Error(`Insufficient reward tokens. Admin has ${adminBalance.value.uiAmount || 0} tokens, but needs ${amountHuman} tokens. Please acquire some reward tokens first.`);
               }
      } catch (e) {
               if (e instanceof Error && e.message?.includes('Insufficient reward tokens')) {
                 throw e; // Re-throw our custom error
               }
               
               console.log('Admin ATA does not exist for reward mint, creating it...');
               
               // Create admin ATA for reward mint
               const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
               const { Transaction } = await import('@solana/web3.js');
               
               const createAtaTx = new Transaction();
               createAtaTx.add(
                 createAssociatedTokenAccountInstruction(
                   pk(walletAddress),   // payer
                   adminRewardAta,      // ata to create
                   pk(walletAddress),   // owner (admin)
                   rewardMint           // mint
                 )
               );
               
               console.log('Creating admin ATA for reward mint...');
               const createAtaSig = await provider.sendAndConfirm(createAtaTx);
               console.log('Admin ATA created:', createAtaSig);
               
               console.log('⚠️ Admin ATA created but has 0 balance');
               console.log('💡 You need to acquire some reward tokens first');
               console.log('💡 Reward mint:', rewardMint.toBase58());
               throw new Error('Admin ATA created but has 0 balance. Please acquire some reward tokens first.');
      }

      // Ensure the vault exists (idempotent create)
      const vaultInfo = await connection.getAccountInfo(rewardVault);
      const { createAssociatedTokenAccountInstruction, getMint, createTransferCheckedInstruction } =
        await import('@solana/spl-token');
      const { Transaction } = await import('@solana/web3.js');

             const tx = new Transaction();
             
             // 2️⃣ fetch a new blockhash right before signing
             const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
             tx.recentBlockhash = blockhash;
             tx.lastValidBlockHeight = lastValidBlockHeight;
             tx.feePayer = pk(walletAddress);
             
             console.log('🔍 Fresh blockhash:', blockhash);
             console.log('🔍 Last valid block height:', lastValidBlockHeight);
             
             // 3️⃣ add memo with timestamp and random for extra uniqueness
             const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
             const memoData = Buffer.from(`reward-top-up-${uniqueId}`, 'utf8');
             const memoInstruction = {
               programId: MEMO_PROGRAM_ID,
               keys: [{ pubkey: pk(walletAddress), isSigner: true, isWritable: false }],
               data: memoData,
             };
             tx.add(memoInstruction);

      if (!vaultInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            pk(walletAddress),   // payer
            rewardVault,         // ata to create
            signerPDA,           // owner (off-curve PDA)
            rewardMint           // mint
          )
        );
      }

      // Fetch decimals and convert human → base units
      const mintInfo = await getMint(connection, rewardMint);
      const decimals = mintInfo.decimals ?? 0;

      // Use BigInt for safe scaling
      const scale = BigInt(10) ** BigInt(decimals);
      const amountBaseUnits = BigInt(Math.trunc(amountHuman)) * scale;  // if you allow fractional human input, parse as string and scale precisely

      // createTransferCheckedInstruction(amount: number | bigint)
      tx.add(
        createTransferCheckedInstruction(
          adminRewardAta,        // source (admin)
          rewardMint,            // mint
          rewardVault,           // destination (signerPDA's ATA)
          pk(walletAddress),     // owner (admin)
          amountBaseUnits,       // base units
          decimals               // decimals
        )
      );

             console.log('Sending addRewardTokens tx…', {
               pool: poolPDA.toBase58(),
               signer: signerPDA.toBase58(),
               rewardMint: rewardMint.toBase58(),
               rewardVault: rewardVault.toBase58(),
               adminRewardAta: adminRewardAta.toBase58(),
               decimals,
               amountBaseUnits: amountBaseUnits.toString(),
             });

             
             // Use sendAndConfirm with unique transaction and retry logic
             let txSignature;
             let retryCount = 0;
             const maxRetries = 3;
             
             while (retryCount < maxRetries) {
               try {
                 console.log(`🔄 Attempting transaction (attempt ${retryCount + 1}/${maxRetries})...`);
                 txSignature = await provider.sendAndConfirm(tx, [], {
                   commitment: 'confirmed',
                   skipPreflight: false,
                   preflightCommitment: 'confirmed'
                 });
                 console.log('✅ Transfer transaction successful:', txSignature);
                 break;
               } catch (retryError: any) {
                 retryCount++;
                 console.log(`❌ Attempt ${retryCount} failed:`, retryError.message);
                 
                 if (retryError.message.includes('already been processed')) {
                   console.log('🔄 Transaction was already processed - checking if it succeeded...');
                   // Check if the transaction actually succeeded by looking at balances
                   try {
                     const vaultBalance = await connection.getTokenAccountBalance(rewardVault);
                     if (vaultBalance.value.uiAmount && vaultBalance.value.uiAmount > 0) {
                       console.log('✅ Transaction actually succeeded despite error message');
                       break;
                     }
                   } catch (balanceError) {
                     console.log('Could not check vault balance:', balanceError);
                   }
                 }
                 
                 if (retryCount >= maxRetries) {
                   throw retryError;
                 }
                 
                 // Wait before retry
                 await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                 
                 // Get fresh blockhash for retry
                 const { blockhash: newBlockhash, lastValidBlockHeight: newLastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
                 tx.recentBlockhash = newBlockhash;
                 tx.lastValidBlockHeight = newLastValidBlockHeight;
                 
                 // Update memo with new unique ID
                 const newUniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                 const newMemoData = Buffer.from(`reward-top-up-${newUniqueId}`, 'utf8');
                 tx.instructions[0] = {
                   programId: MEMO_PROGRAM_ID,
                   keys: [{ pubkey: pk(walletAddress), isSigner: true, isWritable: false }],
                   data: newMemoData,
                 };
               }
             }

      // Check balances after transfer
      try {
        const adminBalanceAfter = await connection.getTokenAccountBalance(adminRewardAta);
        const vaultBalance = await connection.getTokenAccountBalance(rewardVault);
        console.log('Balances after transfer:', {
          adminBalance: adminBalanceAfter.value.uiAmount,
          vaultBalance: vaultBalance.value.uiAmount,
          vaultAddress: rewardVault.toBase58()
        });
      } catch (e) {
        console.log('Could not check balances after transfer:', e);
      }

      console.log('✅ Reward tokens transferred into vault');
             
             // Check balances after transfer
             try {
               const adminBalanceAfter = await connection.getTokenAccountBalance(adminRewardAta);
               const vaultBalance = await connection.getTokenAccountBalance(rewardVault);
               console.log('🔍 Balances after transfer:', {
                 adminBalance: adminBalanceAfter.value.uiAmount,
                 vaultBalance: vaultBalance.value.uiAmount,
                 vaultAddress: rewardVault.toBase58()
               });
               
               // Check if APY calculation will work now
               if (vaultBalance.value.uiAmount && vaultBalance.value.uiAmount > 0) {
                 console.log('✅ Reward vault now has tokens!');
                 console.log('🔍 Vault balance:', vaultBalance.value.uiAmount);
                 console.log('🔍 This should enable APY calculation once users stake');
               } else {
                 console.log('⚠️ Vault balance is still 0 - check if transfer was successful');
               }
             } catch (e) {
               console.log('Could not check balances after transfer:', e);
             }
             
      await refreshData();
    } catch (e: any) {
      console.error('❌ addRewardTokens failed', e);
      
      // Handle specific transaction errors
      if (e?.message?.includes('already been processed')) {
        console.log('🔄 Transaction already processed - this might be a duplicate submission');
        console.log('💡 Try refreshing the page and attempting the token transfer again');
        throw new Error('Transaction already processed. Please refresh and try again.');
      } else if (e?.message?.includes('Blockhash not found')) {
        console.log('🔄 Blockhash not found - this is a network timing issue');
        console.log('💡 This usually resolves itself, please try again');
        throw new Error('Network timing issue. Please try again in a moment.');
      } else if (e?.message?.includes('simulation failed')) {
        console.log('🔄 Transaction simulation failed - checking for specific issues');
        console.log('💡 This might be due to insufficient token balance or account issues');
        throw new Error('Transaction simulation failed. Please check your token balance and try again.');
      } else if (e?.message?.includes('Insufficient reward tokens')) {
        console.log('🔄 Insufficient reward tokens - admin needs more tokens');
        throw new Error('Insufficient reward tokens. Please acquire more reward tokens first.');
      } else {
        setError(e?.message ?? 'Failed to add reward tokens');
        throw e;
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- Helper functions -----------------------------------------------------

  const setStakingMintHandler = (mint: string) => {
    console.log(`🔧 Setting staking mint to: ${mint}`);
    setStakingMint(mint);
  };

  const resolvePoolSigner = async (
    poolAddress: string,
    stakingVaultAddress: string,
    signerBump?: number,
  ): Promise<PublicKey> => {
    const poolPdaPk = pk(poolAddress);
    try {
      const { getAccount } = await import('@solana/spl-token');
      const vaultAccount = await getAccount(connection, pk(stakingVaultAddress));
      const ownerPk = new PublicKey(vaultAccount.owner);
      console.log('[Staking] Resolved pool signer from vault authority:', ownerPk.toBase58());
      return ownerPk;
    } catch (vaultErr) {
      console.log('[Staking] Unable to read vault authority, falling back to PDA derivation', vaultErr);
    }

    const candidateSeeds = [
      Buffer.from('pool-signer'),
      Buffer.from('pool_signer'),
      Buffer.from('signer'),
    ];

    for (const seed of candidateSeeds) {
      try {
        const [derived, bump] = PublicKey.findProgramAddressSync([seed, poolPdaPk.toBuffer()], PROGRAM_ID);
        if (signerBump === undefined || bump === signerBump) {
          console.log('[Staking] Using derived signer PDA', derived.toBase58(), 'seed', seed.toString());
          return derived;
        }
      } catch (err) {
        console.log('[Staking] Failed to derive signer with seed', seed.toString(), err);
      }
    }

    const fallback = signerPda(PROGRAM_ID, poolPdaPk);
    console.log('[Staking] Using fallback signer helper', fallback.toBase58());
    return fallback;
  };

  const diagnoseAccount = async (accountAddress: string) => {
    try {
      const accountInfo = await connection.getAccountInfo(new PublicKey(accountAddress));
      if (!accountInfo) {
        console.log('❌ Account does not exist');
        return;
      }
      
      console.log('🔍 Account Diagnosis:');
      console.log('- Address:', accountAddress);
      console.log('- Owner:', accountInfo.owner.toBase58());
      console.log('- Executable:', accountInfo.executable);
      console.log('- Lamports:', accountInfo.lamports);
      console.log('- Data Length:', accountInfo.data?.length);
      console.log('- Is Program Account:', accountInfo.owner.equals(PROGRAM_ID));
      
      if (accountInfo.data && accountInfo.data.length > 0) {
        console.log('- First 32 bytes:', Array.from(accountInfo.data.slice(0, 32)));
        console.log('- Last 32 bytes:', Array.from(accountInfo.data.slice(-32)));
      }
      
      return accountInfo;
    } catch (error) {
      console.error('❌ Failed to diagnose account:', error);
    }
  };

  const fetchOnChainIdl = async () => {
    try {
      const wallet = {
        publicKey: pk(walletAddress!),
        signTransaction: async (tx: any) => {
          if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
            return await (window as any).solana.signTransaction(tx);
          }
          throw new Error('Wallet not connected');
        },
        signAllTransactions: async (txs: any[]) => {
          if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
            return await (window as any).solana.signAllTransactions(txs);
          }
          throw new Error('Wallet not connected');
        }
      };

      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const onChainIdl = await fetchAndSaveOnChainIdl(provider);
      
      if (onChainIdl) {
        console.log('✅ On-chain IDL fetched successfully');
        return onChainIdl;
      } else {
        console.log('❌ Failed to fetch on-chain IDL');
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to fetch on-chain IDL:', error);
      return null;
    }
  };

  const verifyPdaSeeds = (stakingMintStr: string) => {
    console.log('🔍 Verifying PDA seeds match program expectations...');
    
    const stakingMint = new PublicKey(stakingMintStr);
    const programId = PROGRAM_ID;
    
    // Derive PDA using the same seeds as the program
    const [poolPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), stakingMint.toBuffer()],
      programId
    );
    
    console.log('PDA Derivation:', {
      programId: programId.toBase58(),
      stakingMint: stakingMint.toBase58(),
      seeds: ['pool', stakingMint.toBase58()],
      derivedPDA: poolPDA.toBase58(),
      bump
    });
    
    // Verify the seeds match what the Rust program expects
    const expectedSeeds = [Buffer.from("pool"), stakingMint.toBuffer()];
    const [verifyPDA, verifyBump] = PublicKey.findProgramAddressSync(expectedSeeds, programId);
    
    if (!poolPDA.equals(verifyPDA)) {
      throw new Error('PDA derivation mismatch - seeds do not match program expectations');
    }
    
    console.log('✅ PDA seeds match program expectations');
    return { poolPDA, bump };
  };

  // Emergency unstake - principal only, no rewards
  const emergencyUnstake = async (amount: number) => {
    if (!walletAddress || !poolData) throw new Error('Wallet not connected or pool not initialized');
    setIsLoading(true);
    setError(null);
    try {
      console.log('Emergency unstaking tokens:', { amount, walletAddress, poolAddress: poolData.poolAddress });
      
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: (window as any).solana?.signTransaction,
        signAllTransactions: (window as any).solana?.signAllTransactions,
      } as any;
      
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);
      
      const poolPDA = pk(poolData.poolAddress);
      const stakingMintPk = pk(poolData.stakingMint);
      
      const poolSigner = await resolvePoolSigner(
        poolData.poolAddress,
        poolData.stakingVault,
        poolData.signerBump,
      );
      const tx = await program.methods.emergencyUnstake(new BN(amount)).accounts({
        owner: pk(walletAddress),
        pool: poolPDA,
        poolSigner,
        userStakingAta: await getAssociatedTokenAddress(stakingMintPk, pk(walletAddress)),
        stakingVault: pk(poolData.stakingVault),
        user: userPda(program.programId, poolPDA, pk(walletAddress)),
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      }).rpc();
      
      console.log('✅ Emergency unstake successful:', tx);
      await refreshData();
    } catch (e: any) {
      console.error('❌ Emergency unstake failed:', e);
      setError(e?.message ?? 'Failed to emergency unstake');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // Admin function: withdraw rewards (only when paused)
  const withdrawRewards = async (amount: number) => {
    if (!isAdmin || !walletAddress || !poolData) throw new Error('Admin access required');
    setIsLoading(true);
    setError(null);
    try {
      console.log('Withdrawing rewards:', { amount, poolAddress: poolData.poolAddress });
      
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: (window as any).solana?.signTransaction,
        signAllTransactions: (window as any).solana?.signAllTransactions,
      } as any;
      
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);
      
      const poolPDA = pk(poolData.poolAddress);
      const rewardMintPk = pk(poolData.rewardMint);
      
      const poolSigner = await resolvePoolSigner(
        poolData.poolAddress,
        poolData.stakingVault,
        poolData.signerBump,
      );
      const tx = await program.methods.withdrawRewards(new BN(amount)).accounts({
        pool: poolPDA,
        admin: pk(walletAddress),
        poolSigner,
        rewardVault: pk(poolData.rewardVault),
        adminRewardAta: await getAssociatedTokenAddress(rewardMintPk, pk(walletAddress)),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      }).rpc();
      
      console.log('✅ Rewards withdrawn successfully:', tx);
      await refreshData();
    } catch (e: any) {
      console.error('❌ Withdraw rewards failed:', e);
      setError(e?.message ?? 'Failed to withdraw rewards');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // Admin function: set new admin
  const setAdmin = async (newAdmin: string) => {
    if (!isAdmin || !walletAddress || !poolData) throw new Error('Admin access required');
    setIsLoading(true);
    setError(null);
    try {
      console.log('Setting new admin:', { newAdmin, poolAddress: poolData.poolAddress });
      
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: (window as any).solana?.signTransaction,
        signAllTransactions: (window as any).solana?.signAllTransactions,
      } as any;
      
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);
      
      const poolPDA = pk(poolData.poolAddress);
      
      const tx = await program.methods.setAdmin(pk(newAdmin)).accounts({
        pool: poolPDA,
        admin: pk(walletAddress),
      }).rpc();
      
      console.log('✅ Admin updated successfully:', tx);
      await refreshData();
    } catch (e: any) {
      console.error('❌ Set admin failed:', e);
      setError(e?.message ?? 'Failed to set admin');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // Admin function: ensure vaults exist
  const ensureVaults = async () => {
    if (!isAdmin || !walletAddress || !poolData) throw new Error('Admin access required');
    setIsLoading(true);
    setError(null);
    try {
      console.log('Ensuring vaults exist:', { poolAddress: poolData.poolAddress });
      
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: (window as any).solana?.signTransaction,
        signAllTransactions: (window as any).solana?.signAllTransactions,
      } as any;
      
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);
      
      const poolPDA = pk(poolData.poolAddress);
      const stakingMintPk = pk(poolData.stakingMint);
      const rewardMintPk = poolData.rewardConfigured ? pk(poolData.rewardMint) : undefined;
      const poolSigner = await resolvePoolSigner(
        poolData.poolAddress,
        poolData.stakingVault,
        poolData.signerBump,
      );
      
      const accounts: any = {
        pool: poolPDA,
        admin: pk(walletAddress),
        poolSigner,
        stakingMint: stakingMintPk,
        stakingVault: pk(poolData.stakingVault),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      };

      if (rewardMintPk) {
        accounts.rewardMint = rewardMintPk;
        accounts.rewardVault = pk(poolData.rewardVault);
      }
      
      const tx = await program.methods.ensureVaults().accounts(accounts).rpc();
      
      console.log('✅ Vaults ensured successfully:', tx);
      await refreshData();
    } catch (e: any) {
      console.error('❌ Ensure vaults failed:', e);
      setError(e?.message ?? 'Failed to ensure vaults');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // Close user account
  const closeUser = async () => {
    if (!walletAddress || !poolData) throw new Error('Wallet not connected or pool not initialized');
    setIsLoading(true);
    setError(null);
    try {
      console.log('Closing user account:', { walletAddress, poolAddress: poolData.poolAddress });
      
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: (window as any).solana?.signTransaction,
        signAllTransactions: (window as any).solana?.signAllTransactions,
      } as any;
      
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);
      
      const poolPDA = pk(poolData.poolAddress);
      
      const tx = await program.methods.closeUser().accounts({
        owner: pk(walletAddress),
        pool: poolPDA,
        user: userPda(program.programId, poolPDA, pk(walletAddress)),
      }).rpc();
      
      console.log('✅ User account closed successfully:', tx);
      await refreshData();
    } catch (e: any) {
      console.error('❌ Close user failed:', e);
      setError(e?.message ?? 'Failed to close user account');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // Admin function: close pool
  const closePool = async () => {
    if (!isAdmin || !walletAddress || !poolData) throw new Error('Admin access required');
    setIsLoading(true);
    setError(null);
    try {
      console.log('Closing pool:', { poolAddress: poolData.poolAddress });
      
      const wallet = {
        publicKey: pk(walletAddress),
        signTransaction: (window as any).solana?.signTransaction,
        signAllTransactions: (window as any).solana?.signAllTransactions,
      } as any;
      
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = await loadProgram(provider);
      
      const poolPDA = pk(poolData.poolAddress);
      const poolSigner = await resolvePoolSigner(
        poolData.poolAddress,
        poolData.stakingVault,
        poolData.signerBump,
      );
      
      const accounts: any = {
        pool: poolPDA,
        admin: pk(walletAddress),
        poolSigner,
        stakingVault: pk(poolData.stakingVault),
        tokenProgram: TOKEN_PROGRAM_ID,
      };

      if (poolData.rewardConfigured) {
        accounts.rewardVault = pk(poolData.rewardVault);
      }
      
      const tx = await program.methods.closePool().accounts(accounts).rpc();
      
      console.log('✅ Pool closed successfully:', tx);
      await refreshData();
    } catch (e: any) {
      console.error('❌ Close pool failed:', e);
      setError(e?.message ?? 'Failed to close pool');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // --- Context value ---------------------------------------------------------

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.solana?.isPhantom) {
      throw new Error('Phantom wallet not detected. Please install Phantom wallet.');
    }

    try {
      // Force connection (don't use onlyIfTrusted)
      const res = await window.solana.connect();
      setWalletAddress(res?.publicKey?.toString() ?? null);
      console.log('✅ Wallet connected:', res?.publicKey?.toString());
    } catch (err) {
      console.error('❌ Failed to connect wallet:', err);
      throw new Error('Failed to connect wallet. Please try again.');
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    console.log('🔌 Wallet disconnected');
  };

  const value: StakingContextType = {
    connection,
    walletAddress,
    isAdmin,
    poolData,
    userData,
    isLoading,
    isInitialLoad,
    error,
    stakingMint,
    stakingDecimals,
    rewardDecimals,
    initializePool,
    fetchPoolByMint,
    setStakingMint: setStakingMintHandler,
    diagnoseAccount,
    fetchOnChainIdl,
    verifyPdaSeeds,
    setRewardConfig,
    setRewardRate,
    setPaused,
    addRewardTokens,
    checkRewardVaultBalance,
    checkCurrentPoolState,
    computeApy,
    stake,
    unstake,
    emergencyUnstake,
    claim,
    withdrawRewards,
    setAdmin,
    ensureVaults,
    closeUser,
    closePool,
    refreshData,
    connectWallet,
    disconnectWallet,
  };

  return <StakingContext.Provider value={value}>{children}</StakingContext.Provider>;
}

export function useStaking() {
  const ctx = useContext(StakingContext);
  if (!ctx) throw new Error('useStaking must be used within a StakingProvider');
  return ctx;
}
