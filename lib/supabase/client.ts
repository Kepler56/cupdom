import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client (Client Components, event handlers).
 * Uses the publishable/anon key, which is RLS-gated and safe to ship to the browser.
 * The service-role key is NEVER used here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
