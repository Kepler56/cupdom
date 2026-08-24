import { EndedCampaignCard } from '@/components/public/EndedCampaignCard';

// Local fallback for an unknown/Terminée campaign (Spec 2B's /campagne-terminee is the canonical
// ended page; this mirrors it for the /c/[slug] route). No form, no events.
export default function LeadCaptureNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4 sm:p-6">
      <EndedCampaignCard />
    </main>
  );
}
