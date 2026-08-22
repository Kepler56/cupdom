// Shared domain types for the Cupdom CRM (Spec 1A).
// Single source of truth for the taxonomy used by both the SQL CHECK lists and the UI selects.

export type Sector =
  | 'Boissons & Spiritueux' | 'Restauration & Alimentaire' | 'Mode & Accessoires'
  | 'Beauté & Cosmétiques' | 'Technologie & Logiciels' | 'Télécoms'
  | 'Médias & Divertissement' | 'Événementiel & Nightlife' | 'Sport & Fitness'
  | 'Santé & Bien-être' | 'Finance & Assurance' | 'Automobile & Mobilité'
  | 'Commerce & Distribution' | 'Tourisme & Hôtellerie' | 'Éducation & Formation'
  | 'Secteur public & Associations' | 'Autre';

export const SECTORS: readonly Sector[] = [
  'Boissons & Spiritueux', 'Restauration & Alimentaire', 'Mode & Accessoires',
  'Beauté & Cosmétiques', 'Technologie & Logiciels', 'Télécoms',
  'Médias & Divertissement', 'Événementiel & Nightlife', 'Sport & Fitness',
  'Santé & Bien-être', 'Finance & Assurance', 'Automobile & Mobilité',
  'Commerce & Distribution', 'Tourisme & Hôtellerie', 'Éducation & Formation',
  'Secteur public & Associations', 'Autre',
] as const;

export type CompanySize =
  | 'Indépendant (0–1)' | '2–9' | '10–49' | '50–249' | '250–999'
  | '1 000–4 999' | '5 000–9 999' | '10 000+';

export const COMPANY_SIZES: readonly CompanySize[] = [
  'Indépendant (0–1)', '2–9', '10–49', '50–249', '250–999',
  '1 000–4 999', '5 000–9 999', '10 000+',
] as const;

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  color: string;
}

export interface Contact {
  id: string;
  ownerId: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  sector: Sector | null;
  companySize: CompanySize | null;
  archivedAt: string | null;
  purgeAfter: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The current view filter (client-side). Data is read-all via RLS; scope narrows what's shown. */
export type Scope =
  | { kind: 'me' }
  | { kind: 'user'; userId: string }
  | { kind: 'all' };

// ── Deals (Spec 1B §3.3) ────────────────────────────────────────────────────
export type DealStage = 'QUALIFICATION' | 'PROPOSITION' | 'NÉGOCIATION' | 'GAGNÉ' | 'PERDU';

/** Source of truth for the SQL CHECK list, the StageSelect, and the Pipeline columns (order matters). */
export const DEAL_STAGES: readonly DealStage[] = [
  'QUALIFICATION', 'PROPOSITION', 'NÉGOCIATION', 'GAGNÉ', 'PERDU',
] as const;

/** Terminal/closed stages (no further pipeline movement). */
export const CLOSED_STAGES: readonly DealStage[] = ['GAGNÉ', 'PERDU'] as const;

export interface Deal {
  id: string;
  contactId: string;
  title: string | null;
  stage: DealStage;
  valueEur: number | null;
  expectedClose: string | null; // ISO date (yyyy-mm-dd)
  createdAt: string;
  updatedAt: string;
}

// ── Derived statut (Spec 1B §3.4) ───────────────────────────────────────────
export type Statut = 'Prospect' | 'En cours' | 'Client' | 'Perdu';
export const STATUTS: readonly Statut[] = ['Prospect', 'En cours', 'Client', 'Perdu'] as const;

/** Contact joined with its derived statut (shape of public.contacts_with_status). */
export interface ContactStatus extends Contact {
  statut: Statut;
}

// ── Activity timeline (Spec 1B §5.8 / built out in 1C) ──────────────────────
// Must stay in sync with the contact_history_kind_check CHECK constraint in Postgres.
// 'archive'/'restore' are written by 0005's archive_contact()/restore_contact().
// This union and the SQL constraint in contact_history_kind_check are one rule stated twice.
export type HistoryKind =
  | 'deal_stage' | 'transfer' | 'contact_edit' | 'task' | 'reminder' | 'link'
  | 'archive' | 'restore' | 'portal_access';

export interface HistoryEntry {
  id: string;
  contactId: string;
  actorId: string | null;
  kind: HistoryKind;
  summary: string | null;
  createdAt: string;
}

// ── Tasks (Spec 1C §5.6) ────────────────────────────────────────────────────
export interface Task {
  id: string;
  contactId: string;
  label: string;
  dueDate: string | null; // ISO date (yyyy-mm-dd); échéance, optional
  doneAt: string | null; // CANONICAL: null = à faire; timestamp = fait (reopen → null)
  createdAt: string;
  updatedAt: string;
}

/** Task joined with its parent contact, for the cross-contact Tâches page. */
export interface OwnerTask extends Task {
  ownerId: string;
  company: string | null;
}

// ── Reminders (Spec 1C §5.7) ────────────────────────────────────────────────
export interface Reminder {
  id: string;
  contactId: string;
  remindOn: string; // ISO date (yyyy-mm-dd); a contact may have many
  note: string | null;
  doneAt: string | null; // CANONICAL: null = en attente; timestamp = traité (reopen → null)
  createdAt: string;
  updatedAt: string;
}

export interface OwnerReminder extends Reminder {
  ownerId: string;
  company: string | null;
}

// ── Links (Spec 1C §5.8) ────────────────────────────────────────────────────
export interface ContactLink {
  id: string;
  contactId: string;
  label: string;
  url: string; // safe scheme only (http/https/mailto/tel), validated in the app
  createdAt: string;
}

// ── Notifications (Spec 1D §5.10) ───────────────────────────────────────────
export type NotificationType = 'reminder_due' | 'task_overdue' | 'gone_quiet' | 'purge_warning';
export type GoneQuietLevel = 'souple' | 'a_surveiller' | 'important' | 'urgent';

export type NotificationPayload =
  | { kind: 'reminder_due'; reminderId: string; note: string | null; remindOn: string; company: string | null }
  | { kind: 'task_overdue'; taskId: string; label: string; dueDate: string; company: string | null }
  | { kind: 'gone_quiet'; level: GoneQuietLevel; silentDays: number; lastActivity: string; company: string | null }
  | { kind: 'purge_warning'; daysLeft: number; purgeAfter: string; company: string | null };

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  contactId: string | null;
  payload: NotificationPayload;
  createdAt: string;
  readAt: string | null; // null = unread
}

/** Silence thresholds (days) → gone-quiet level (AC-39). Highest-first; first match wins. */
export const GONE_QUIET_THRESHOLDS: { days: number; level: GoneQuietLevel }[] = [
  { days: 30, level: 'urgent' },
  { days: 15, level: 'important' },
  { days: 7, level: 'a_surveiller' },
  { days: 2, level: 'souple' },
];

export const GONE_QUIET_TONE: Record<GoneQuietLevel, 'info' | 'warning' | 'danger'> = {
  souple: 'info',
  a_surveiller: 'warning',
  important: 'warning',
  urgent: 'danger',
};

export const GONE_QUIET_LABEL_FR: Record<GoneQuietLevel, string> = {
  souple: 'Souple',
  a_surveiller: 'À surveiller',
  important: 'Important',
  urgent: 'Urgent',
};

export const NOTIF_TYPE_LABEL_FR: Record<NotificationType, string> = {
  reminder_due: 'Rappel à traiter',
  task_overdue: 'Tâche en retard',
  gone_quiet: 'Prospect silencieux',
  purge_warning: 'Suppression imminente',
};

// ── Archive / purge (Spec 1E §5.9) ──────────────────────────────────────────
export const PURGE_WINDOW_DAYS = 30;
export const PURGE_WARNING_DAYS = 3;

/** An archived contact (archivedAt/purgeAfter guaranteed non-null in the Archivés view). */
export interface ArchivedContact extends Contact {
  archivedAt: string;
  purgeAfter: string;
}

export interface PurgeCountdown {
  daysLeft: number;
  label: string; // French, e.g. "Supprimé dans 12 jours" / "Suppression imminente"
  tone: 'warning' | 'danger';
}

/** Result of the archive/restore RPC wrappers (no throw on the expected blocked cases). */
export type LifecycleResult =
  | { ok: true }
  | { ok: false; reason: 'not_owner' | 'active_campaign' | 'not_archived' | 'unknown'; message: string };

// ── CSV export (Spec 1F §5.11) ──────────────────────────────────────────────
export type DatasetId = 'contacts' | 'deals' | 'tasks' | 'campaigns' | 'scan_leads';

/** One CSV column: French header + a pure accessor for the cell (formatting in toCsv). */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/** A dataset the Exporter can produce. `available: false` => listed but greyed ("bientôt"). */
export interface ExportDataset<T = unknown> {
  id: DatasetId;
  label: string; // FR menu label, e.g. 'Contacts'
  fileStem: string; // ASCII filename stem, e.g. 'taches'
  available: boolean;
  columns: CsvColumn<T>[];
}

// ── Campaigns (Spec 2A §2) ──────────────────────────────────────────────────
// State is the existing qr_campaigns.active boolean surfaced as a French label.
export type CampaignState = 'Active' | 'Terminée';
export const CAMPAIGN_STATES: readonly CampaignState[] = ['Active', 'Terminée'] as const;

export interface Campaign {
  slug: string;                 // opaque, immutable PK (6–8 char base32-ish)
  sponsorName: string;          // = linked contact's company at insert time (NOT NULL in DB)
  name: string | null;          // friendly CRM name, e.g. "Nike Été 2026"
  product: string | null;       // optional merch descriptor (gourde, tote…)
  destinationUrl: string;       // http/https; editable; slug/QR never change
  state: CampaignState;         // derived from `active` (Active=true, Terminée=false)
  dealId: string | null;        // FK → deals.id (null = legacy/unlinked, managed by old index.html)
  distributedCount: number | null; // owner-entered "Distribués" funnel input (Spec 3 reads this)
  createdAt: string;            // ISO
}

// ── Campaign event log (Spec 2A §2/§6) ──────────────────────────────────────
export type CampaignEventKind =
  | 'create' | 'deactivate' | 'reactivate' | 'destination_change';

export interface CampaignEvent {
  id: string;
  campaignSlug: string;
  actorId: string | null;       // profiles.id of the acting owner (null for system)
  kind: CampaignEventKind;
  detail: string | null;        // e.g. "https://a → https://b" for a destination change
  createdAt: string;            // ISO (rendered fr-FR date+time)
}

export const CAMPAIGN_EVENT_LABEL_FR: Record<CampaignEventKind, string> = {
  create: 'Création',
  deactivate: 'Désactivation',
  reactivate: 'Réactivation',
  destination_change: 'Changement de destination',
};

// ── Campaign headline stats (Spec 2A §3, AC-25/27) ──────────────────────────
export interface CampaignStats {
  slug: string;
  totalScans: number;           // non-bot scans
  uniquesPerDay: number;        // distinct visitor_hash among non-bot scans
  bots: number;                 // is_bot = true scans
  activeScans: number;          // non-bot scans tagged campaign_state_at_scan='Active'
  termineeScans: number;        // non-bot scans tagged campaign_state_at_scan='Terminée'
  leads: number;                // 0 until Spec 3 lands (placeholder source documented)
  hasScans: boolean;            // (totalScans + bots) > 0 → delete disabled (AC-15)
}

// Row view-model the list renders (campaign joined to its effective owner + stats).
export interface CampaignRowVM extends Campaign {
  ownerId: string | null;       // effective owner = linked contact's owner (null for legacy rows)
  ownerName: string | null;     // resolved display name for OwnerChip
  ownerColor: string | null;    // resolved colour for OwnerChip
  contactCompany: string | null;// = sponsorName, shown in the "Sponsor" column
  dealTitle: string | null;     // linked deal label
  stats: CampaignStats;
}

// ── Leads (Spec 3A §5) — consumer end-users captured at the form (NOT CRM contacts) ──
export interface Lead {
  id: string;
  campaignSlug: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  firstSeenAt: string;        // ISO; set once
  lastActivityAt: string;     // ISO; refreshed on every (re)submission — the 3B retention clock
  createdAt: string;
  updatedAt: string;
}

// ── Consent record (Spec 3A §5 / AC-9) — immutable accountability evidence, NO IP ──
export interface LeadConsent {
  id: string;
  leadId: string | null;
  campaignSlug: string;
  sponsorName: string | null;
  consentText: string;        // the EXACT wording shown to the consumer
  consentVersion: string | null;
  createdAt: string;
}

// ── Funnel events (Spec 3A §6) — one row per non-manual stage crossing ──
export type FunnelEventKind = 'form_view' | 'form_submit' | 'offer_reached';

export interface FunnelEvent {
  id: string;
  campaignSlug: string;
  kind: FunnelEventKind;
  visitorHash: string | null; // best-effort dedupe key (no IP); may be null on the public client
  createdAt: string;
}

// ── Funnel rollup (Spec 3A §6 / AC-14) — counts Spec 4 will chart; this plan provides the data ──
export type FunnelStageId =
  | 'distribues' | 'scannes' | 'formulaire_vu' | 'formulaire_soumis' | 'offre_atteinte';

export interface FunnelStage {
  id: FunnelStageId;
  label: string;              // FR: 'Distribués' | 'Scannés' | 'Formulaire vu' | …
  count: number;
}

// Display order + French labels (single source for the loader and the Spec 4 chart).
export const FUNNEL_STAGES: { id: FunnelStageId; label: string }[] = [
  { id: 'distribues',        label: 'Distribués' },
  { id: 'scannes',           label: 'Scannés' },
  { id: 'formulaire_vu',     label: 'Formulaire vu' },
  { id: 'formulaire_soumis', label: 'Formulaire soumis' },
  { id: 'offre_atteinte',    label: 'Offre atteinte' },
];

// ── Lead GDPR erasure (Spec 3B §7 / AC-15) ──────────────────────────────────
// Result of the owner-gated erase RPC wrapper (no throw on the expected "blocked" case;
// mirrors 1E's LifecycleResult discriminated-union pattern).
export type EraseLeadResult =
  | { ok: true }
  | { ok: false; reason: 'not_owner' | 'not_found' | 'unknown'; message: string };

// ── Funnel presentation (Spec 4 §4.7 / AC-9) ────────────────────────────────
// Step keys + labels reuse the 3A FunnelStageId / FUNNEL_STAGES (identical five-stage order);
// these add the on-screen %/drop presentation derived by lib/funnel.ts#buildFunnel.
export type FunnelStepKey = FunnelStageId;

export interface FunnelStep {
  key: FunnelStepKey;
  label: string;
  count: number;        // absolute units at this stage
  pctOfTop: number;     // 0..100 — count / first-non-zero baseline * 100 (the bar width)
  pctOfPrev: number;    // raw % — count / previous-step count * 100 (per-step conversion, may exceed 100)
  dropFromPrev: number; // 0..100 — max(0, 100 - pctOfPrev) (abandonment at this step)
}

export interface Funnel {
  steps: FunnelStep[];
  biggestDropIdx: number | null; // index of the largest dropFromPrev (>0); earliest on tie; null if none
}

// Raw per-campaign counters fed into buildFunnel (from the 3A campaign_funnel view).
export interface FunnelSources {
  distribues: number;        // qr_campaigns.distributed_count (owner-entered; 0 if unset)
  scannes: number;           // distinct non-bot visitor_hash in qr_scans
  formulaireVu: number;      // funnel_events kind 'form_view'
  formulaireSoumis: number;  // funnel_events kind 'form_submit'
  offreAtteinte: number;     // funnel_events kind 'offer_reached'
}

// ── Aperçu KPIs (Spec 4 §4.1) ───────────────────────────────────────────────
export type KpiKey = 'contacts_actifs' | 'scans_30j' | 'leads_30j' | 'pipeline_eur';

export const KPI_LABEL_FR: Record<KpiKey, string> = {
  contacts_actifs: 'Contacts actifs',
  scans_30j: 'Scans (30 j)',
  leads_30j: 'Leads (30 j)',
  pipeline_eur: 'Pipeline',
};

export interface KpiCardData {
  key: KpiKey;
  label: string;            // French label
  value: string;            // already formatted (number fr-FR or EUR)
  trendPct: number | null;  // signed % vs previous 30 days; null = no trend shown (e.g. pipeline)
  trendSeries?: number[];   // optional 30-point series for the inline sparkline
}

// ── Nested-campaign inline stats (Spec 4 §4.3 Deals tab / AC-7) ──────────────
export interface CampaignStat {
  slug: string;
  name: string;
  active: boolean;          // qr_campaigns.active → Active/Terminée
  scans: number;            // unique non-bot scanners
  leads: number;            // captured leads
  distribues: number;       // distributed_count (0 if unset)
  conversionPct: number;    // leads / scans * 100 (0 when scans = 0)
}
