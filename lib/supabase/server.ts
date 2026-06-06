import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server Supabase client (Server Components, Route Handlers, Server Actions).
 * Reads/writes the session from the request cookies via @supabase/ssr.
 * Anon key only — RLS is the real gate; the session JWT is sent as Bearer so
 * Postgres sees the `authenticated` role.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In a Server Component the cookie store is read-only; the middleware
          // refreshes the session cookie, so swallowing this is safe.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — ignore.
          }
        },
      },
    },
  );
}
