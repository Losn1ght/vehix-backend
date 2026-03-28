import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Anon client — RLS enforced, used for JWT verification in auth middleware
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

// Admin client — bypasses RLS, used for all server-side data operations
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
