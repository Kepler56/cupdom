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
export type HistoryKind =
  | 'deal_stage' | 'transfer' | 'contact_edit' | 'task' | 'reminder' | 'link';

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
