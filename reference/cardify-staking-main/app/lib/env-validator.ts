import { ENV } from '../config/env';

export function validateEnvironment() {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required Supabase variables
  if (!ENV.SUPABASE_URL || ENV.SUPABASE_URL.includes('your_') || ENV.SUPABASE_URL === '') {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is required');
  }
  
  if (!ENV.SUPABASE_ANON_KEY || ENV.SUPABASE_ANON_KEY.includes('your_') || ENV.SUPABASE_ANON_KEY === '') {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }
  
  if (!ENV.SUPABASE_SERVICE_KEY || ENV.SUPABASE_SERVICE_KEY.includes('your_') || ENV.SUPABASE_SERVICE_KEY === '') {
    errors.push('SUPABASE_SERVICE_KEY is required');
  }

  // Check Solana configuration
  if (!ENV.PROGRAM_ID || ENV.PROGRAM_ID === '11111111111111111111111111111111') {
    warnings.push('NEXT_PUBLIC_PROGRAM_ID is not set (using System Program as default)');
  }

  if (!ENV.STAKING_MINT || ENV.STAKING_MINT.includes('your_')) {
    warnings.push('NEXT_PUBLIC_STAKING_MINT is not set');
  }

  if (!ENV.REWARD_MINT || ENV.REWARD_MINT.includes('your_')) {
    warnings.push('NEXT_PUBLIC_REWARD_MINT is not set');
  }

  return { errors, warnings };
}

export function logEnvironmentStatus() {
  const { errors, warnings } = validateEnvironment();
  
  if (errors.length > 0) {
    console.error('❌ Environment Configuration Errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('\n📝 Please update your .env.local file with proper values');
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  Environment Configuration Warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Environment configuration is valid');
  }
}
