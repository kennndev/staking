# Quick Setup Guide

## 🚨 Current Issue
You're getting the error `Invalid PublicKey: your_program_id_here` because your environment variables are still set to placeholder values.

## ✅ Quick Fix

### 1. Update your `.env.local` file
Replace the placeholder values with actual values:

```env
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Solana Configuration (OPTIONAL - will use defaults if not set)
NEXT_PUBLIC_PROGRAM_ID=your_actual_program_id_here
NEXT_PUBLIC_STAKING_MINT=your_staking_mint_here
NEXT_PUBLIC_REWARD_MINT=your_reward_mint_here
```

### 2. Get Supabase Credentials
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY`

### 3. For Solana Configuration (Optional)
If you don't have a program ID yet, you can:
- Leave `NEXT_PUBLIC_PROGRAM_ID` empty (will use System Program)
- Or use a test program ID like: `11111111111111111111111111111111`

### 4. Restart Your Server
```bash
npm run dev
```

## 🔧 What I Fixed
- ✅ Added better error handling for placeholder values
- ✅ Added environment validation
- ✅ Set default values for missing configuration
- ✅ Improved error messages

## 📋 Next Steps
1. **Update `.env.local`** with your Supabase credentials
2. **Run the SQL schema** in Supabase (copy from `supabase_schema.sql`)
3. **Restart your dev server**
4. **Test the ticket system**

The app will work once you add your Supabase credentials!
