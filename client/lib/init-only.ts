/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { loadProgram } from "./idl-loader";
import { pk, poolPda, signerPda } from "./pda";
import { ENV } from "../config/env";

const RPC_URL = ENV.SOLANA_RPC_URL;

/** Prevent double-submits across re-renders/clicks */
let initInFlight = false;

/**
 * Initialize the staking pool once (idempotent).
 * - Derives PDAs
 * - Lets the program create the staking vault ATA
 * - Confirms the tx and treats "already processed" as success after verifying state
 */
export async function initializeOnly(stakingMintStr: string, wallet: any) {
  if (initInFlight) return;
  initInFlight = true;

  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const anchorWallet = {
      publicKey: pk(wallet.publicKey),
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
    } as any;
    const provider = new AnchorProvider(connection, anchorWallet, {
      commitment: "confirmed",
    });

    const program = await loadProgram(provider);

    const stakingMint = pk(stakingMintStr);
    const pool = poolPda(program.programId, stakingMint);
    const signer = signerPda(program.programId, pool);
    const stakingVault = await getAssociatedTokenAddress(stakingMint, signer, true);

    // If already initialized, bail out gracefully
    const pre = await connection.getAccountInfo(pool, { commitment: "processed" });
    if (pre) {
      console.warn("Pool already exists; skipping initialize.");
      return {
        pool: pool.toBase58(),
        signer: signer.toBase58(),
        stakingVault: stakingVault.toBase58(),
      };
    }

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    let sig: string | undefined;
    try {
      sig = await program.methods
        .initialize()
        .accounts({
          admin: provider.wallet.publicKey,
          stakingMint,
          pool,
          poolSigner: signer,
          stakingVault,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed" });

      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );
    } catch (e: any) {
      const msg = String(e?.message ?? e);

      // Wallet/RPC sometimes returns this when the exact signature was re-sent
      if (msg.includes("already been processed")) {
        if (sig) {
          await connection.confirmTransaction(
            { signature: sig, blockhash, lastValidBlockHeight },
            "confirmed"
          );
        }
        // Poll briefly to ensure the account materialized
        for (let i = 0; i < 10; i++) {
          const info = await connection.getAccountInfo(pool, { commitment: "confirmed" });
          if (info) break;
          await new Promise((r) => setTimeout(r, 300));
        }
        const exists = await connection.getAccountInfo(pool, { commitment: "confirmed" });
        if (!exists) throw e; // truly failed
      } else {
        throw e; // bubble real errors
      }
    }

    // Optional: fetch freshly initialized state (safe if IDL matches)
    const acc: any = await (program.account as any).pool.fetch(pool);
    return {
      pool: pool.toBase58(),
      signer: signer.toBase58(),
      stakingVault: stakingVault.toBase58(),
      admin: acc.admin.toBase58(),
      stakingMint: acc.stakingMint.toBase64 ? acc.stakingMint.toBase58() : acc.stakingMint.toBase58?.() ?? String(acc.stakingMint),
      totalStaked:
        acc.totalStaked?.toString?.() ?? String(acc.totalStaked),
      ratePerSec:
        acc.rewardRatePerSec?.toString?.() ?? String(acc.rewardRatePerSec),
    };
  } finally {
    initInFlight = false;
  }
}
