import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on every request except Next internals, static assets, and `/s/...` — the public
  // scan redirector is a Netlify Edge Function (scan.js); the auth middleware must NOT run
  // there or it bounces anonymous scanners to /login before the redirect happens.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|s/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
