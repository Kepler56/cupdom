/** The public page's card: flush hero on top (hence no padding here), soft lift off the canvas. */
export function PublicCardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[440px] overflow-hidden rounded-hero border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.12)]">
      {children}
    </div>
  );
}
