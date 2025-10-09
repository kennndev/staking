// Environment Configuration
export const ENV = {
  // Solana Configuration
  SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL!,
  PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID!,
  ADMIN_WALLET: process.env.NEXT_PUBLIC_ADMIN_WALLET!,
  
  // Network Configuration
  NETWORK: process.env.NEXT_PUBLIC_NETWORK!,
  
  // Token Configuration
  STAKING_MINT: process.env.NEXT_PUBLIC_STAKING_MINT!,
  REWARD_MINT: process.env.NEXT_PUBLIC_REWARD_MINT || '',
  
  // App Configuration
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Solana Staking Dashboard',
  APP_DESCRIPTION: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Professional Solana staking dashboard for monitoring and managing your staked tokens',
  
  // OpenAI Configuration
  OPENAI_API_KEY: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  
  // Supabase Configuration
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || '',
} as const;

// Contract constants
export const CONTRACT_CONFIG = {
  PROGRAM_ID: ENV.PROGRAM_ID,
  ADMIN_WALLET: ENV.ADMIN_WALLET,
  RPC_URL: ENV.SOLANA_RPC_URL,
  SCALAR: 1_000_000_000_000,
} as const;

// Token configurations
export const TOKEN_CONFIG = {
  STAKING_MINT: ENV.STAKING_MINT,
  REWARD_MINT: ENV.REWARD_MINT,
} as const;