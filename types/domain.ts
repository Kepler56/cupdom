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
