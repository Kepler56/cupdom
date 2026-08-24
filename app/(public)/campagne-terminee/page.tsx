import type { Metadata } from 'next';
import { EndedCampaignCard } from '@/components/public/EndedCampaignCard';

// Public route (no auth guard, no Supabase read) — an anonymous scanner must reach it.
// Served by the redirector for BOTH a Terminée campaign and an unknown slug (Spec 2B §9).
export const metadata: Metadata = {
  title: 'Campagne terminée — Cupdom',
  description: 'Cette campagne n’est plus active.',
};

export default function CampagneTermineePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4 sm:p-6">
      <EndedCampaignCard />
    </main>
  );
}
