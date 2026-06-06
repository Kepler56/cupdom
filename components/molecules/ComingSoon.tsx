/** Placeholder for pages built in later plans (Pipeline 1B, Tâches/Rappels 1C, Campagnes Spec 2). */
export function ComingSoon({ feature }: { feature: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-10 text-center">
      <p className="text-sm font-medium text-text">{feature}</p>
      <p className="mt-1 text-sm text-text-muted">Bientôt disponible.</p>
    </div>
  );
}
