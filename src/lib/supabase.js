import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (
  import.meta.env.SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL
)?.trim();
const supabasePublishableKey = (
  import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

if (!supabaseUrl || !supabasePublishableKey) {
  console.error('[supabase] Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to enable cloud features.');
}

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  })
  : null;
