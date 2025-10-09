import { PublicKey } from "@solana/web3.js";
import { ENV } from "../config/env";

// Debug function to show how to derive the pool PDA
export function debugPoolDerivation(stakingMint: string, programId: string) {
  console.log("🔍 Pool PDA Derivation Debug:");
  console.log("Program ID:", programId);
  console.log("Staking Mint:", stakingMint);
  
  // Derive the pool PDA using the same seeds as the Rust code
  const programPk = new PublicKey(programId);
  const mintPk = new PublicKey(stakingMint);
  
  const [poolPDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), mintPk.toBuffer()],
    programPk
  );
  
  console.log("Pool PDA:", poolPDA.toBase58());
  console.log("Bump:", bump);
  
  return {
    programId,
    stakingMint,
    poolPDA: poolPDA.toBase58(),
    bump
  };
}

// Test with environment values
export function testYourPool() {
  return debugPoolDerivation(ENV.STAKING_MINT, ENV.PROGRAM_ID);
}
