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
  // Keys are typically long base64 strings, allow local keys
  return key.length > 30 && !key.includes('your-') && !key.includes('placeholder');
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
// Only create if properly configured, otherwise create a dummy that will show setup message
let supabaseInstance: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  supabaseInstance = createClientComponentClient();
}

// Safely export supabase client
export const supabase = supabaseInstance || new Proxy({} as SupabaseClient, {
  get: (_target, prop) => {
    // Return undefined for 'then' to prevent Promise-like behavior checks from crashing
    if (prop === 'then') return undefined;
    throw new Error(
      'Supabase is not configured. Please check your .env.local file to ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set correctly.'
    );
  }
});

// Server-side Supabase client with service role (for admin operations)
// Only create if properly configured
let supabaseAdminInstance: SupabaseClient | null = null;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (isValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) && isValidSupabaseKey(serviceRoleKey)) {
  supabaseAdminInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey!,
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

