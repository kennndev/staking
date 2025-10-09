# Environment Setup Guide

## Required Environment Variables

You need to add these environment variables to your `.env.local` file in the root of your project:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

## How to Get Your Supabase Credentials

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project** (or create a new one)
3. **Go to Settings > API**
4. **Copy the following values**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY`

## Example .env.local file

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Your existing environment variables
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=your_program_id
NEXT_PUBLIC_ADMIN_WALLET=your_admin_wallet
# ... other existing variables
```

## Important Notes

- **NEXT_PUBLIC_** prefix is required for client-side access
- **SUPABASE_SERVICE_KEY** should NOT have the NEXT_PUBLIC_ prefix (it's server-side only)
- Make sure `.env.local` is in your `.gitignore` file
- Restart your development server after adding environment variables

## Troubleshooting

If you're still getting the "supabaseKey is required" error:

1. **Check your .env.local file exists** in the project root
2. **Verify the variable names** match exactly (case-sensitive)
3. **Restart your development server**: `npm run dev`
4. **Check the Supabase dashboard** to ensure your project is active

## Security

- Never commit your `.env.local` file to version control
- The `SUPABASE_SERVICE_KEY` has admin privileges - keep it secure
- Use different keys for development and production environments
