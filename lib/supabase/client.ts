import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Fallback project credentials if env vars are momentarily unset in browser chunks
export const DEFAULT_SUPABASE_URL = 'https://chauqwnfzjskbucoppwb.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_tIiXKR2izJukHfR8YF_XFg_lEFi3aw-';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

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
    isValidSupabaseUrl(SUPABASE_URL) &&
    isValidSupabaseKey(SUPABASE_ANON_KEY)
  );
}

// Get configuration status for display
export function getSupabaseConfigStatus(): {
  configured: boolean;
  urlValid: boolean;
  keyValid: boolean;
  url: string;
} {
  return {
    configured: isSupabaseConfigured(),
    urlValid: isValidSupabaseUrl(SUPABASE_URL),
    keyValid: isValidSupabaseKey(SUPABASE_ANON_KEY),
    url: SUPABASE_URL,
  };
}

// Global singleton cache across Next.js HMR and module re-evaluations
const globalForSupabase = globalThis as unknown as {
  __supabaseInstance?: SupabaseClient;
  __supabaseAdminInstance?: SupabaseClient;
};

// Client-side Supabase client for use in React components (singleton)
if (!globalForSupabase.__supabaseInstance && isSupabaseConfigured()) {
  try {
    globalForSupabase.__supabaseInstance = createClientComponentClient({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_ANON_KEY,
    });
  } catch (err) {
    console.warn('createClientComponentClient failed, using createClient fallback:', err);
    globalForSupabase.__supabaseInstance = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
            return await fn();
          },
        }
      }
    );
  }
}

export const supabase = globalForSupabase.__supabaseInstance || new Proxy({} as SupabaseClient, {
  get: (_target, prop) => {
    if (prop === 'then') return undefined;
    throw new Error(
      'Supabase is not configured. Please check your .env.local file to ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set correctly.'
    );
  }
});

// Server-side Supabase client for admin operations (Strictly server-only; NEVER instantiated on the browser)
if (typeof window === 'undefined') {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isServiceRoleJwt = serviceRoleKey && !serviceRoleKey.startsWith('sb_secret_') && serviceRoleKey.length > 30;
  const effectiveKey: string = (isServiceRoleJwt && serviceRoleKey ? serviceRoleKey : SUPABASE_ANON_KEY);

  if (!globalForSupabase.__supabaseAdminInstance && isValidSupabaseUrl(SUPABASE_URL) && isValidSupabaseKey(effectiveKey)) {
    globalForSupabase.__supabaseAdminInstance = createClient(
      SUPABASE_URL,
      effectiveKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
}

export const supabaseAdmin = (typeof window === 'undefined' ? globalForSupabase.__supabaseAdminInstance : globalForSupabase.__supabaseInstance) || new Proxy({} as SupabaseClient, {
  get: (_target, prop) => {
    if (prop === 'then') return undefined;
    if (typeof window !== 'undefined' && globalForSupabase.__supabaseInstance) {
      return (globalForSupabase.__supabaseInstance as any)[prop];
    }
    throw new Error(
      'Supabase Admin is not configured. Please check your .env.local file to ensure SUPABASE_SERVICE_ROLE_KEY is set correctly.'
    );
  }
});
