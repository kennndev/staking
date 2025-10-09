# Environment Variables Configuration

This document describes all the environment variables used by the NPC Stake application.

## Required Environment Variables

### Solana Configuration
- `NEXT_PUBLIC_SOLANA_RPC_URL` - Solana RPC endpoint (default: https://api.devnet.solana.com)
- `NEXT_PUBLIC_PROGRAM_ID` - Your staking program ID (default: CG7e3BfRFQn1AVUdXFRUsQBiKHtSpCiH7afhpJaoE4PT)
- `NEXT_PUBLIC_ADMIN_WALLET` - Admin wallet address for pool management
- `NEXT_PUBLIC_MEMO_PROGRAM_ID` - Memo program ID for transaction signatures (default: MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr)

### Token Configuration
- `NEXT_PUBLIC_STAKING_MINT` - The token mint address for staking (e.g., NPC token)
- `NEXT_PUBLIC_REWARD_MINT` - The token mint address for rewards

### Network Configuration
- `NEXT_PUBLIC_NETWORK` - Network name (default: devnet)

## Optional Environment Variables

### App Configuration
- `NEXT_PUBLIC_APP_NAME` - Application name (default: NPC Stake)
- `NEXT_PUBLIC_APP_DESCRIPTION` - Application description

### OpenAI Configuration (Optional)
- `NEXT_PUBLIC_OPENAI_API_KEY` - OpenAI API key for AI features

### Supabase Configuration (Optional)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service key (server-side only)

## Example .env File

```bash
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=CG7e3BfRFQn1AVUdXFRUsQBiKHtSpCiH7afhpJaoE4PT
NEXT_PUBLIC_ADMIN_WALLET=your_admin_wallet_address_here
NEXT_PUBLIC_MEMO_PROGRAM_ID=MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr

# Network Configuration
NEXT_PUBLIC_NETWORK=devnet

# Token Configuration
NEXT_PUBLIC_STAKING_MINT=your_staking_token_mint_address
NEXT_PUBLIC_REWARD_MINT=your_reward_token_mint_address

# App Configuration
NEXT_PUBLIC_APP_NAME=NPC Stake
NEXT_PUBLIC_APP_DESCRIPTION=Professional Solana staking dashboard for NPC token

# OpenAI Configuration (Optional)
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here

# Supabase Configuration (Optional)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

## Usage in Code

All environment variables are accessed through the `ENV` object in `client/config/env.ts`:

```typescript
import { ENV, CONTRACT_CONFIG } from '@/config/env';

// Access environment variables
const programId = ENV.PROGRAM_ID;
const rpcUrl = ENV.SOLANA_RPC_URL;
const adminWallet = ENV.ADMIN_WALLET;

// Access contract configuration
const contractProgramId = CONTRACT_CONFIG.PROGRAM_ID;
const memoProgramId = CONTRACT_CONFIG.MEMO_PROGRAM_ID;
```

## Notes

- All environment variables with `NEXT_PUBLIC_` prefix are exposed to the client-side code
- Server-side only variables (like `SUPABASE_SERVICE_KEY`) should not have the `NEXT_PUBLIC_` prefix
- Default values are provided for most configuration options
- Make sure to set the required variables before deploying to production
