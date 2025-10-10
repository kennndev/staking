import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';

// Check if we have real Supabase credentials
const hasRealCredentials = supabaseUrl !== 'https://placeholder.supabase.co' && supabaseKey !== 'placeholder-key';

if (!hasRealCredentials) {
  console.log('⚠️ [SUPABASE] Using placeholder credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY for real database.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types for TypeScript
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: number;
          wallet_address: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          wallet_address: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          wallet_address?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      game_sessions: {
        Row: {
          id: number;
          user_id: number;
          game_type: 'cyber-defense' | 'pop-pop';
          score: number;
          session_duration: number | null;
          level_reached: number | null;
          additional_data: any | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: number;
          game_type: 'cyber-defense' | 'pop-pop';
          score: number;
          session_duration?: number | null;
          level_reached?: number | null;
          additional_data?: any | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: number;
          game_type?: 'cyber-defense' | 'pop-pop';
          score?: number;
          session_duration?: number | null;
          level_reached?: number | null;
          additional_data?: any | null;
          created_at?: string;
        };
      };
    };
  };
}
