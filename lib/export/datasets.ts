import type { ContactStatus, CsvColumn, DatasetId, ExportDataset, OwnerTask } from '@/types/domain';
import type { ScopeDeal } from '@/lib/deals';
import type { CampaignExportRow, ScanLeadRow } from '@/lib/export/leadsLoaders';

type NameOf = (ownerId: string) => string;

const fmtDate = (v: string | null | undefined): string =>
  v ? new Intl.DateTimeFormat('fr-FR').format(new Date(v)) : '';

const col = (header: string, value: (r: unknown) => string | number | null | undefined): CsvColumn<unknown> => ({
  header,
  value,
});

function contactsDataset(nameOf: NameOf): ExportDataset {
  const c = (r: unknown) => r as ContactStatus;
  return {
    id: 'contacts', label: 'Contacts', fileStem: 'contacts', available: true,
    columns: [
      col('Prénom', (r) => c(r).firstName),
      col('Nom', (r) => c(r).lastName),
      col('Poste', (r) => c(r).role),
      col('Entreprise', (r) => c(r).company),
      col('Secteur', (r) => c(r).sector),
      col('Taille', (r) => c(r).companySize),
      col('Statut', (r) => c(r).statut),
      col('Email', (r) => c(r).email),
      col('Téléphone', (r) => c(r).phone),
      col('Attribué à', (r) => nameOf(c(r).ownerId)),
      col('Archivé le', (r) => fmtDate(c(r).archivedAt)),
      col('Créé le', (r) => fmtDate(c(r).createdAt)),
      col('Mis à jour le', (r) => fmtDate(c(r).updatedAt)),
    ],
  };
}

function dealsDataset(nameOf: NameOf): ExportDataset {
  const d = (r: unknown) => r as ScopeDeal;
  return {
    id: 'deals', label: 'Deals', fileStem: 'deals', available: true,
    columns: [
      // ScopeDeal carries the parent contact's company; the contact person name can be
      // added when the deals export is mounted on a page that loads it.
      col('Contact', (r) => d(r).company),
      col('Entreprise', (r) => d(r).company),
      col('Étape', (r) => d(r).stage),
      col('Valeur (€)', (r) => d(r).valueEur),
      col('Date de clôture prévue', (r) => fmtDate(d(r).expectedClose)),
      col('Attribué à', (r) => nameOf(d(r).ownerId)),
      col('Créé le', (r) => fmtDate(d(r).createdAt)),
    ],
  };
}

function tasksDataset(nameOf: NameOf): ExportDataset {
  const t = (r: unknown) => r as OwnerTask;
  return {
    id: 'tasks', label: 'Tâches', fileStem: 'taches', available: true,
    columns: [
      col('Contact', (r) => t(r).company),
      col('Libellé', (r) => t(r).label),
      col('Échéance', (r) => fmtDate(t(r).dueDate)),
      col('Statut (fait/à faire)', (r) => (t(r).doneAt ? 'fait' : 'à faire')),
      col('Terminée le', (r) => fmtDate(t(r).doneAt)),
      col('Attribué à', (r) => nameOf(t(r).ownerId)),
      col('Créé le', (r) => fmtDate(t(r).createdAt)),
    ],
  };
}

// Live since Spec 3A (migration 0007 supplies leads + the funnel). Loaders/row types live in
// lib/export/leadsLoaders.ts; the registry shape stays owned by 1F.
function campaignsDataset(): ExportDataset {
  const c = (r: unknown) => r as CampaignExportRow;
  return {
    id: 'campaigns', label: 'Campagnes', fileStem: 'campagnes', available: true,
    columns: [
      col('Campagne', (r) => c(r).name),
      col('Contact', (r) => c(r).contactName),
      col('Deal', (r) => c(r).dealTitle),
      col('Statut', (r) => c(r).statut),
      col('Scans', (r) => c(r).scans),
      col('Leads', (r) => c(r).leads),
      col('Créé le', (r) => fmtDate(c(r).createdAt)),
    ],
  };
}

const pct = (v: number): string => `${(v * 100).toFixed(1).replace('.', ',')} %`;

function scanLeadsDataset(): ExportDataset {
  const s = (r: unknown) => r as ScanLeadRow;
  // Ville/Appareil/Période are per-scan breakdowns (Spec 4 analytics) — blank in this aggregate.
  return {
    id: 'scan_leads', label: 'Stats scans-leads', fileStem: 'stats-scans-leads', available: true,
    columns: [
      col('Campagne', (r) => s(r).name),
      col('Scans', (r) => s(r).scans),
      col('Leads', (r) => s(r).leads),
      col('Taux de conversion', (r) => pct(s(r).conversionRate)),
      col('Ville', () => ''),
      col('Appareil', () => ''),
      col('Période', () => ''),
    ],
  };
}

/** Build a dataset's columns with an owner-id → display-name resolver (for "Attribué à"). */
export function getDataset(id: DatasetId, nameOf: NameOf = (x) => x): ExportDataset {
  switch (id) {
    case 'contacts':
      return contactsDataset(nameOf);
    case 'deals':
      return dealsDataset(nameOf);
    case 'tasks':
      return tasksDataset(nameOf);
    case 'campaigns':
      return campaignsDataset();
    case 'scan_leads':
      return scanLeadsDataset();
  }
}

/** Stable menu order. */
const ORDER: DatasetId[] = ['contacts', 'deals', 'tasks', 'campaigns', 'scan_leads'];
export const EXPORT_DATASETS: ExportDataset[] = ORDER.map((id) => getDataset(id));
