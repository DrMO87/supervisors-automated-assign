import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Validate Supabase URL
function isValidSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  // Allow local Supabase endpoints (http://127.0.0.1 or localhost)
  if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) return true;
  return url.startsWith('https://') && url.includes('.supabase.co');
}

// Validate Supabase Key
function isValidSupabaseKey(key: string | undefined): boolean {
  if (!key) return false;
  return key.length > 20 && !key.includes('your-') && !key.includes('placeholder');
}

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return (
    isValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    isValidSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

// Get configuration status for display
export function getSupabaseConfigStatus(): {
  configured: boolean;
  urlValid: boolean;
  keyValid: boolean;
  url: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return {
    configured: isSupabaseConfigured(),
    urlValid: isValidSupabaseUrl(url),
    keyValid: isValidSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    url: url,
  };
}

// Client-side Supabase client for use in React components
let supabaseInstance: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  supabaseInstance = createClientComponentClient();
}

export const supabase = supabaseInstance || new Proxy({} as SupabaseClient, {
  get: (_target, prop) => {
    if (prop === 'then') return undefined;
    throw new Error(
      'Supabase is not configured. Please check your .env.local file to ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set correctly.'
    );
  }
});

// Server-side Supabase client for admin operations
let supabaseAdminInstance: SupabaseClient | null = null;

// Prefer service role key if valid JWT, else fall back to anon key
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isServiceRoleJwt = serviceRoleKey && !serviceRoleKey.startsWith('sb_secret_') && serviceRoleKey.length > 30;
const effectiveKey = isServiceRoleJwt ? serviceRoleKey : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || serviceRoleKey);

if (isValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) && isValidSupabaseKey(effectiveKey)) {
  supabaseAdminInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    effectiveKey!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export const supabaseAdmin = supabaseAdminInstance || new Proxy({} as SupabaseClient, {
  get: (_target, prop) => {
    if (prop === 'then') return undefined;
    throw new Error(
      'Supabase Admin is not configured. Please check your .env.local file to ensure SUPABASE_SERVICE_ROLE_KEY is set correctly.'
    );
  }
});
