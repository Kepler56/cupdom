import type { Metadata } from 'next';
import { LeadForm } from './LeadForm';

// PUBLIC lead form (Spec 3A) — outside the (app) auth-guard. An Active /s/:slug scan (Spec 2B)
// hands off here. The campaign's Active-status + sponsor are resolved CLIENT-SIDE via the
// lead-submit Edge Function (anon cannot SELECT qr_campaigns under RLS); the form re-validates
// Active server-side on submit too (defense in depth, §10). A Terminée/unknown campaign renders
// the branded ended notice instead of the form — no event/lead is recorded.
export const metadata: Metadata = {
  title: 'Recevez votre offre — Cupdom',
  description: 'Renseignez vos coordonnées pour recevoir l’offre du sponsor.',
};

export default async function LeadCapturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <LeadForm slug={slug} />
    </main>
  );
}
