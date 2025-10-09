// IDL loader that prefers on-chain IDL and falls back to local
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { ENV } from '../config/env';
import idlData from '../idl/simple_staking.json';

// Extended IDL interface that includes address
interface IdlWithAddress extends Idl {
  address?: string;
}

// Use environment configuration
export const RPC_URL = ENV.SOLANA_RPC_URL;
export const PROGRAM_ID = new PublicKey(ENV.PROGRAM_ID);

// 1) Try to fetch IDL from chain. 2) else require local file.
export async function loadProgram(provider: AnchorProvider): Promise<Program> {
  let idl: Idl | null = null;
  try {
    console.log('Attempting to fetch IDL from chain...');
    idl = await Program.fetchIdl(PROGRAM_ID, provider);
    console.log('✅ IDL fetched from chain successfully');
  } catch (error) {
    console.log('❌ Failed to fetch IDL from chain:', error);
  }
  
  if (!idl) {
    console.log('Falling back to local IDL...');
    // falls back to local IDL exactly as compiled
    idl = idlData as Idl;
    console.log('✅ Local IDL loaded successfully');
  }
  
  // Optional: assert the IDL really refers to our program id
  const idlWithAddress = idl as IdlWithAddress;
  const idlAddr = idlWithAddress.address;
  if (idlAddr && idlAddr !== PROGRAM_ID.toBase58()) {
    throw new Error(`IDL.address (${idlAddr}) !== PROGRAM_ID (${PROGRAM_ID.toBase58()})`);
  }
  
  console.log('Creating program with IDL:', {
    version: idl?.version,
    name: idl?.name,
    address: idlWithAddress?.address,
    instructionsCount: idl?.instructions?.length || 0,
    accountsCount: idl?.accounts?.length || 0,
    typesCount: idl?.types?.length || 0
  });
  
  return new Program(idl as Idl, PROGRAM_ID, provider);
}

export function makeProvider(connection: Connection, wallet: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
}