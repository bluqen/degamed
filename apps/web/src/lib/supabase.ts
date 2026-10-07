import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isAuthConfigured } from './env';

export const supabase: SupabaseClient | null = isAuthConfigured
  ? createClient(env.supabaseUrl!, env.supabaseKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
