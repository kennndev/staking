const processEnv = typeof process !== "undefined" ? process.env ?? {} : {};
// vite injects env vars on import.meta.env – guard for SSR/tests
const metaEnv =
  typeof import.meta !== "undefined" && (import.meta as any)?.env
    ? ((import.meta as any).env as Record<string, string | undefined>)
    : {};

const getEnv = (key: string, fallback = ""): string => {
  const value = processEnv[key] ?? metaEnv[key];
  return value !== undefined ? value : fallback;
};

// Environment Configuration
export const ENV = {
  // Solana Configuration
  SOLANA_RPC_URL: getEnv("NEXT_PUBLIC_SOLANA_RPC_URL", "https://api.devnet.solana.com"),
  PROGRAM_ID: getEnv("NEXT_PUBLIC_PROGRAM_ID", "CG7e3BfRFQn1AVUdXFRUsQBiKHtSpCiH7afhpJaoE4PT"),
  ADMIN_WALLET: getEnv("NEXT_PUBLIC_ADMIN_WALLET", "FWqD9UHbEKKbCeAKNTFJRYkbr8VxhqabUd3nH3uJebMJ"),
  MEMO_PROGRAM_ID: getEnv("NEXT_PUBLIC_MEMO_PROGRAM_ID", "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),

  // Network Configuration
  NETWORK: getEnv("NEXT_PUBLIC_NETWORK", ""),

  // Token Configuration
  STAKING_MINT: getEnv("NEXT_PUBLIC_STAKING_MINT", ""),
  REWARD_MINT: getEnv("NEXT_PUBLIC_REWARD_MINT", ""),

  // App Configuration
  APP_NAME: getEnv("NEXT_PUBLIC_APP_NAME", "NPC Stake"),
  APP_DESCRIPTION: getEnv(
    "NEXT_PUBLIC_APP_DESCRIPTION",
    "Professional Solana staking dashboard for NPC token",
  ),


  // Supabase Configuration
  SUPABASE_URL: getEnv("NEXT_PUBLIC_SUPABASE_URL", ""),
  SUPABASE_ANON_KEY: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""),
  SUPABASE_SERVICE_KEY:
    getEnv("SUPABASE_SERVICE_KEY", getEnv("NEXT_PUBLIC_SUPABASE_SERVICE_KEY", "")),
} as const;

// Debug environment variable loading
console.log('[ENV] Environment variables loaded:', {
  PROGRAM_ID: ENV.PROGRAM_ID,
  ADMIN_WALLET: ENV.ADMIN_WALLET,
  STAKING_MINT: ENV.STAKING_MINT,
  REWARD_MINT: ENV.REWARD_MINT,
  RPC_URL: ENV.SOLANA_RPC_URL,
  fromEnv: {
    PROGRAM_ID: getEnv("NEXT_PUBLIC_PROGRAM_ID"),
    ADMIN_WALLET: getEnv("NEXT_PUBLIC_ADMIN_WALLET"),
    STAKING_MINT: getEnv("NEXT_PUBLIC_STAKING_MINT"),
    REWARD_MINT: getEnv("NEXT_PUBLIC_REWARD_MINT"),
  }
});

// Contract constants
export const CONTRACT_CONFIG = {
  PROGRAM_ID: ENV.PROGRAM_ID,
  ADMIN_WALLET: ENV.ADMIN_WALLET,
  RPC_URL: ENV.SOLANA_RPC_URL,
  MEMO_PROGRAM_ID: ENV.MEMO_PROGRAM_ID,
  SCALAR: 1_000_000_000_000,
} as const;

// Token configurations
export const TOKEN_CONFIG = {
  STAKING_MINT: ENV.STAKING_MINT,
  REWARD_MINT: ENV.REWARD_MINT,
} as const;
