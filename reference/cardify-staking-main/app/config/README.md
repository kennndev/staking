# Environment Configuration

## Setup Instructions

Create a `.env.local` file in your project root with the following variables:

```bash
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=HS7zB9UDrdZP61F1jymf4mqvFrudLLjLS9Hjvmck4iKb
NEXT_PUBLIC_ADMIN_WALLET=E7nsPwmdXmEfPnsVEkjMbGFGfYqUo7kGVu5X2k2AuXSY

# Network Configuration
NEXT_PUBLIC_NETWORK=devnet

# Token Configuration (Update these with your actual token addresses)
NEXT_PUBLIC_STAKING_MINT=So11111111111111111111111111111111111111112
NEXT_PUBLIC_REWARD_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# App Configuration
NEXT_PUBLIC_APP_NAME=Solana Staking Dashboard
NEXT_PUBLIC_APP_DESCRIPTION=Professional Solana staking dashboard for monitoring and managing your staked tokens

# OpenAI Configuration (for AI chatbot)
OPENAI_API_KEY=your_openai_api_key_here
```

## Configuration Variables

### Solana Configuration
- `NEXT_PUBLIC_SOLANA_RPC_URL`: Solana RPC endpoint
- `NEXT_PUBLIC_PROGRAM_ID`: Your deployed program ID
- `NEXT_PUBLIC_ADMIN_WALLET`: Admin wallet address

### Network Configuration
- `NEXT_PUBLIC_NETWORK`: Network (devnet, testnet, mainnet)

### Token Configuration
- `NEXT_PUBLIC_STAKING_MINT`: Staking token mint address
- `NEXT_PUBLIC_REWARD_MINT`: Reward token mint address

### App Configuration
- `NEXT_PUBLIC_APP_NAME`: Application name
- `NEXT_PUBLIC_APP_DESCRIPTION`: Application description

### OpenAI Configuration
- `OPENAI_API_KEY`: OpenAI API key for AI chatbot functionality

## Default Values

If environment variables are not set, the application will use the default values defined in `app/config/env.ts`.
