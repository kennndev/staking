import { PublicKey } from "@solana/web3.js";

/** Coerce any base58 string or PublicKey into a PublicKey */
export const pk = (x: string | PublicKey | null | undefined): PublicKey => {
  if (x instanceof PublicKey) {
    return x;
  }
  
  // Handle null/undefined
  if (!x) {
    throw new Error('PublicKey is null or undefined. Please ensure wallet is connected.');
  }
  
  // Handle empty or placeholder strings
  if (typeof x === 'string' && (x.trim() === '' || x.includes('your_') || x.includes('_here'))) {
    throw new Error(`Invalid or placeholder PublicKey: ${x}. Please set proper environment variables.`);
  }
  
  try {
    return new PublicKey(x);
  } catch (error) {
    throw new Error(`Invalid PublicKey format: ${x}. Expected a valid base58 string.`);
  }
};

/** pool = PDA("pool", staking_mint) */
export function poolPda(programId: string | PublicKey, stakingMint: string | PublicKey): PublicKey {
  const pid = pk(programId);
  const mint = pk(stakingMint);
  return PublicKey.findProgramAddressSync([Buffer.from("pool"), mint.toBuffer()], pid)[0];
}

/** signer = PDA("pool-signer", pool) - exact seed the Rust program uses */
export function signerPda(programId: string | PublicKey, pool: string | PublicKey): PublicKey {
  const pid = pk(programId);
  const poolPk = pk(pool);
  
  // Use exact same seed the Rust code uses (with hyphen)
  return PublicKey.findProgramAddressSync([Buffer.from("pool-signer"), poolPk.toBuffer()], pid)[0];
}

/** Legacy helper for old pools that were initialized with "signer" seed */
export function signerPdaLegacy(programId: string | PublicKey, pool: string | PublicKey): PublicKey {
  const pid = pk(programId);
  const poolPk = pk(pool);
  return PublicKey.findProgramAddressSync([Buffer.from("signer"), poolPk.toBuffer()], pid)[0];
}

/** Smart signer PDA that detects which seed to use based on pool data */
export function signerPdaSmart(
  programId: string | PublicKey, 
  pool: string | PublicKey, 
  poolData?: { signerBump?: number }
): PublicKey {
  const pid = pk(programId);
  const poolPk = pk(pool);
  
  // If we have pool data with signerBump, we can determine which seed was used
  if (poolData?.signerBump !== undefined) {
    // Try new seed first
    const [newAddr, newBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_signer"), poolPk.toBuffer()],
      pid
    );
    
    // If the bump matches, use the new seed
    if (newBump === poolData.signerBump) {
      return newAddr;
    }
    
    // Otherwise, try legacy seed
    const [legacyAddr, legacyBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("signer"), poolPk.toBuffer()],
      pid
    );
    
    if (legacyBump === poolData.signerBump) {
      return legacyAddr;
    }
  }
  
  // Default to new seed (for new pools)
  return PublicKey.findProgramAddressSync([Buffer.from("pool_signer"), poolPk.toBuffer()], pid)[0];
}

/** user = PDA("user", pool, owner) */
export function userPda(
  programId: string | PublicKey,
  pool: string | PublicKey,
  owner: string | PublicKey
): PublicKey {
  const pid = pk(programId);
  const poolPk = pk(pool);
  const ownerPk = pk(owner);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user"), poolPk.toBuffer(), ownerPk.toBuffer()],
    pid
  )[0];
}
