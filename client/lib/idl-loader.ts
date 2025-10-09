import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { pk } from "./pda";
import { normalizeIdlTypes } from "../utils/idl-normalize";
import { ENV } from "../config/env";
import idlData from '../idl/simple_staking.json';

// Program ID as a PublicKey
export const PROGRAM_ID: PublicKey = pk(ENV.PROGRAM_ID);

// Helper function to fetch and save on-chain IDL for debugging
export async function fetchAndSaveOnChainIdl(provider: AnchorProvider, outputPath?: string) {
  try {
    console.log("🔍 Fetching on-chain IDL for debugging...");
    const onChainIdl = await Program.fetchIdl(PROGRAM_ID, provider);
    
    if (onChainIdl) {
      console.log("✅ On-chain IDL fetched successfully");
      console.log("On-chain IDL structure:", {
        version: onChainIdl?.version,
        name: onChainIdl?.name,
        hasInstructions: !!onChainIdl?.instructions,
        hasAccounts: !!onChainIdl?.accounts,
        hasTypes: !!onChainIdl?.types
      });
      
      // Check Pool account structure
      const poolAccount = onChainIdl.accounts?.find(acc => acc.name.toLowerCase() === 'pool');
      if (poolAccount) {
        console.log("🔍 Pool account structure from on-chain IDL:");
        console.log("- Fields count:", poolAccount.type.fields?.length || 0);
        console.log("- Fields:", poolAccount.type.fields?.map(f => ({ name: f.name, type: f.type })));
      }
      
      return onChainIdl;
    } else {
      console.log("❌ No on-chain IDL found");
      return null;
    }
  } catch (error) {
    console.error("❌ Failed to fetch on-chain IDL:", error);
    return null;
  }
}

export async function loadProgram(provider: AnchorProvider) {
  let idl: Idl;
  
  // Try to fetch on-chain IDL first (recommended approach)
  try {
    console.log("🔍 Fetching on-chain IDL...");
    console.log("Program ID:", PROGRAM_ID.toBase58());
    console.log("Provider connection:", provider.connection.rpcEndpoint);
    
    const onChainIdl = await Program.fetchIdl(PROGRAM_ID, provider);
    
    if (onChainIdl) {
      console.log("✅ On-chain IDL fetched successfully");
      idl = onChainIdl;
      
      // Set the address to ensure proper coder layout
      (idl as any).address = PROGRAM_ID.toBase58();
      
      console.log("On-chain IDL structure:", {
        version: idl?.version,
        name: idl?.name,
        address: (idl as any)?.address,
        hasInstructions: !!idl?.instructions,
        hasAccounts: !!idl?.accounts,
        hasTypes: !!idl?.types
      });
      
      // Check if Pool account exists in the IDL
      const poolAccount = idl.accounts?.find(acc => acc.name.toLowerCase() === 'pool');
      if (poolAccount) {
        console.log("✅ Pool account found in on-chain IDL");
        console.log("Pool account fields:", poolAccount.type.fields?.length || 0);
      } else {
        console.warn("⚠️ Pool account not found in on-chain IDL");
      }
      
    } else {
      throw new Error("No on-chain IDL found");
    }
  } catch (onChainError) {
    console.log("❌ Failed to fetch on-chain IDL:", onChainError instanceof Error ? onChainError.message : String(onChainError));
    console.log("🔄 Trying alternative on-chain IDL fetch...");
    
    // Try alternative approach to fetch on-chain IDL
    try {
      const alternativeIdl = await Program.fetchIdl(PROGRAM_ID, provider);
      if (alternativeIdl) {
        console.log("✅ Alternative on-chain IDL fetch successful");
        idl = alternativeIdl;
        (idl as any).address = PROGRAM_ID.toBase58();
      } else {
        throw new Error("Alternative fetch also failed");
      }
    } catch (altError) {
      console.log("❌ Alternative on-chain IDL fetch also failed:", altError);
      console.log("🔄 Falling back to local IDL...");
      
      // Fallback to local IDL
      idl = idlData as Idl;
      console.log("✅ Local IDL loaded as fallback");
      
      // Debug local IDL structure
      console.log("Local IDL structure:", {
        version: idl?.version,
        name: idl?.name,
        address: (idl as any)?.address,
        hasInstructions: !!idl?.instructions,
        hasAccounts: !!idl?.accounts,
        hasTypes: !!idl?.types
      });
      
      // Set the address for local IDL too
      (idl as any).address = PROGRAM_ID.toBase58();
    }
  }

  try {
    console.log("Creating Program instance...");
    const program = new Program(idl as Idl, PROGRAM_ID, provider);
    console.log("✅ Program created successfully");
    return program;
  } catch (error) {
    console.error("❌ Failed to create Program:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    
    // Try with normalized IDL as final fallback
    console.log("Trying with normalized IDL as final fallback...");
    try {
      const normalizedIdl = normalizeIdlTypes(idl);
      const program = new Program(normalizedIdl as Idl, PROGRAM_ID, provider);
      console.log("✅ Program created with normalized IDL");
      return program;
    } catch (normalizedError) {
      console.error("❌ All IDL approaches failed:", normalizedError);  
      throw new Error(`Failed to create Program: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
