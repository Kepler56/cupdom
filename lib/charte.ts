/**
 * The Cupdom charte graphique (Édition 01, juin 2026) as typed constants.
 *
 * Mirrors the CSS custom properties in app/globals.css. Both exist because the
 * UI needs CSS variables while Recharts takes colours as JS props. The unit
 * test locks these values so the two cannot drift apart unnoticed.
 *
 * HARD RULE: jaune is NEVER text on white — it fails contrast. Fills, marks and
 * series only. Text on jaune is always encre.
 */
export const CHARTE = Object.freeze({
  /** Fond de page. The ground — this is what makes the portal read as Cupdom. */
  creme: '#F4EFE3',
  /** Cartes, tables. */
  blanc: '#FFFFFF',
  /** Texte, sidebar, boutons primaires. */
  encre: '#111110',
  /** Le signal. Nav active, série principale, accents KPI, remplissages CTA. */
  jaune: '#FCC917',
  /** Accent · profondeur & confiance. Domine la vue "Où". */
  bleu: '#003082',
  /** Accent · fun. Usage rare, une seule catégorie emphatique. */
  rose: '#FF0099',
  /** Accent · énergie. Fin de rampe séquentielle uniquement. */
  orange: '#F56600',
  /** Bordure teintée chaud, dérivée du crème — jamais un gris froid. */
  border: '#E7E0D0',
  textBody: '#4A4741',
  /**
   * Assombri depuis #8A8478 le 2026-08-28.
   *
   * L'ancienne valeur donnait 3,72:1 sur blanc et 3,24:1 sur crème, sous le
   * minimum AA de 4,5:1 — et ce jeton porte la quasi-totalité du texte
   * secondaire du portail (sous-titres de cartes, libellés de KPI, notes).
   * Mesuré par Lighthouse sur /login, relevé TRA-A04.
   *
   * #6A665C garde la teinte chaude (h≈40°) et donne 5,73:1 sur blanc,
   * 4,99:1 sur crème. Reste nettement plus clair que textBody (9,26:1) :
   * la hiérarchie à trois niveaux tient toujours.
   */
  textMuted: '#6A665C',
} as const);

/**
 * Fixed categorical order for multi-series charts.
 *
 * The charte's "un seul accent à la fois" governs marketing compositions, where
 * two accents fight. A five-category chart needs five colours. The compromise:
 * one accent dominates per view, and jaune/orange are never ADJACENT — which is
 * the interdiction that actually matters (charte §04, contraste insuffisant).
 */
export const CHART_SERIES = Object.freeze([
  CHARTE.jaune,
  CHARTE.bleu,
  CHARTE.encre,
  CHARTE.rose,
  CHARTE.orange,
] as const);

/**
 * Sequential ramp for the heure × jour heatmap.
 *
 * This places jaune next to orange, which the charte forbids for the LOGO —
 * that interdiction concerns legibility of the wordmark. As a sequential ramp
 * it is perceptually correct. Deliberate, user-approved deviation (spec §3.2).
 */
export const HEATMAP_RAMP = Object.freeze([
  CHARTE.creme,
  CHARTE.jaune,
  CHARTE.orange,
  CHARTE.encre,
] as const);
