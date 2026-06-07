// Single source of truth for the lead retention window, mirrored by the SQL interval '36 months'
// in run_lead_anonymisation (migration 0008) and by every piece of UI / privacy-policy copy + tests.
// PLACEHOLDER pending DPO sign-off (the figure AND the consent wording/version are provisional, §7/§12).
// If the DPO changes this, edit it HERE and the SQL interval together — keep them in sync.
export const RETENTION_MONTHS = 36;

// French copy derived from the const, so the figure lives in exactly one place.
export const RETENTION_COPY_FR =
  `Vos données sont conservées ${RETENTION_MONTHS} mois à compter de votre dernière activité, ` +
  `puis anonymisées.`;
