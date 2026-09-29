/**
 * Le point-couvercle — the Cupdom mark (charte §07).
 *
 * "Le point de CUPDOM n'est pas une ponctuation. C'est un couvercle vu du
 * dessus." A filled disc pierced by the straw hole. Five jobs across the
 * portal: active-nav marker, list bullet, empty-state mark, spinner, trame.
 *
 * The hole is 22% of the radius. Below roughly a sixth it stops reading as a
 * hole and the mark degrades into a plain dot — which is the one failure the
 * charte warns about at small sizes (§03, "en deçà, le point disparaît").
 */
export function Point({
  size = 12,
  filled = true,
  hole = 'var(--canvas)',
  className,
}: {
  size?: number;
  filled?: boolean;
  /** The straw hole is painted, not cut. On a white surface pass 'var(--surface)'. */
  hole?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="11" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 2} />
      <circle cx="12" cy="12" r="2.4" fill={hole} />
    </svg>
  );
}
