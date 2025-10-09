/* eslint-disable @typescript-eslint/no-explicit-any */
import { 
  Connection, 
  PublicKey
} from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { loadProgram, makeProvider } from './idl-loader';
import { 
  initialize as initializeHelper, 
  setRewardConfig as setRewardConfigHelper, 
  stakeTokens as stakeTokensHelper, 
  unstakeTokens as unstakeTokensHelper, 
  claimRewards as claimRewardsHelper, 
  fetchPoolData as fetchPoolDataHelper, 
  fetchUserData as fetchUserDataHelper 
} from './staking-helpers';

// Program ID - use the one from idl-loader
export { PROGRAM_ID } from './idl-loader';

// Create a wallet adapter for Anchor
export function createWalletAdapter(publicKey: PublicKey, signTransaction?: any, signAllTransactions?: any) {
  return {
    publicKey: publicKey,
    signTransaction: signTransaction || (async (tx: any) => {
      if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
        try {
          // Ensure wallet is connected before signing
          if (!(window as any).solana.isConnected) {
            await (window as any).solana.connect();
          }
          return await (window as any).solana.signTransaction(tx);
        } catch (error: any) {
          console.error('Error signing transaction:', error);
          throw new Error('Failed to sign transaction: ' + error.message);
        }
      }
      throw new Error('Phantom wallet not detected or not available');
    }),
    signAllTransactions: signAllTransactions || (async (txs: any[]) => {
      if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
        try {
          // Ensure wallet is connected before signing
          if (!(window as any).solana.isConnected) {
            await (window as any).solana.connect();
          }
          return await (window as any).solana.signAllTransactions(txs);
        } catch (error: any) {
          console.error('Error signing transactions:', error);
          throw new Error('Failed to sign transactions: ' + error.message);
        }
      }
      throw new Error('Phantom wallet not detected or not available');
    }),
  };
}

// Get program instance using the clean loader approach
export async function getProgram(connection: Connection, publicKey: PublicKey): Promise<Program> {
  console.log('Creating wallet adapter...');
  const wallet = createWalletAdapter(publicKey);
  
  console.log('Wallet adapter created:', {
    hasPublicKey: !!wallet.publicKey,
    publicKeyString: wallet.publicKey.toString(),
    hasSignTransaction: typeof wallet.signTransaction === 'function',
    hasSignAllTransactions: typeof wallet.signAllTransactions === 'function'
  });
  
  console.log('Creating provider and loading program...');
  const provider = makeProvider(connection, wallet);
  const program = await loadProgram(provider);
  
  console.log('✅ Program loaded successfully');
  return program;
}

// Export the clean PDA functions
export { poolPda, signerPda, userPda } from './staking-helpers';

// Initialize pool using clean helper
export async function initializePool(
  program: Program,
  admin: PublicKey,
  stakingMint: PublicKey
) {
  return await initializeHelper({ program, admin, stakingMint });
}

// Set reward configuration using clean helper
export async function setRewardConfig(
  program: Program,
  admin: PublicKey,
  pool: PublicKey,
  rewardMint: PublicKey,
  ratePerSec: number
) {
  return await setRewardConfigHelper({ program, admin, pool, rewardMint, ratePerSec });
}

// Stake tokens using clean helper
export async function stakeTokens(
  program: Program,
  owner: PublicKey,
  pool: PublicKey,
  stakingMint: PublicKey,
  amount: number
) {
  return await stakeTokensHelper({ program, owner, pool, stakingMint, amount });
}

// Unstake tokens using clean helper
export async function unstakeTokens(
  program: Program,
  owner: PublicKey,
  pool: PublicKey,
  stakingMint: PublicKey,
  amount: number
) {
  return await unstakeTokensHelper({ program, owner, pool, stakingMint, amount });
}

// Claim rewards using clean helper
export async function claimRewards(
  program: Program,
  owner: PublicKey,
  pool: PublicKey,
  rewardMint: PublicKey
) {
  return await claimRewardsHelper({ program, owner, pool, rewardMint });
}

// Fetch pool data using clean helper
export async function fetchPoolData(program: Program, pool: PublicKey) {
  return await fetchPoolDataHelper(program, pool);
}

// Fetch user data using clean helper
export async function fetchUserData(program: Program, pool: PublicKey, owner: PublicKey) {
  return await fetchUserDataHelper(program, pool, owner);
}

