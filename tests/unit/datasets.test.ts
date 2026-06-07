import { describe, expect, it } from 'vitest';
import { EXPORT_DATASETS, getDataset } from '@/lib/export/datasets';
import { leadCsvColumns } from '@/lib/export/leadsLoaders';
import { toCsv } from '@/lib/export/toCsv';
import type { ContactStatus } from '@/types/domain';

const headerOf = (csv: string) => csv.slice(1).split('\r\n')[0];

describe('export dataset registry', () => {
  it('contacts header row is the exact FR columns in order', () => {
    const ds = getDataset('contacts');
    expect(headerOf(toCsv([], ds.columns))).toBe(
      'Prénom;Nom;Poste;Entreprise;Secteur;Taille;Statut;Email;Téléphone;Attribué à;Archivé le;Créé le;Mis à jour le',
    );
  });

  it('availability flags: all five datasets live since Spec 3A (campaigns/scan_leads enabled)', () => {
    const avail = Object.fromEntries(EXPORT_DATASETS.map((d) => [d.id, d.available]));
    expect(avail).toMatchObject({ contacts: true, deals: true, tasks: true, campaigns: true, scan_leads: true });
  });

  it('campaigns header row is the exact FR columns in order', () => {
    expect(headerOf(toCsv([], getDataset('campaigns').columns))).toBe('Campagne;Contact;Deal;Statut;Scans;Leads;Créé le');
  });

  it('leadCsvColumns produce the FR lead header and serialise a sample lead', () => {
    const csv = toCsv(
      [{ firstName: 'Marie', lastName: 'Curie', email: 'm@x.fr', phone: '0612', firstSeenAt: '2026-06-01T00:00:00Z' }],
      leadCsvColumns,
    );
    expect(headerOf(csv)).toBe('Prénom;Nom;Email;Téléphone;Capturé le');
    expect(csv.slice(1).split('\r\n')[1].startsWith('Marie;Curie;m@x.fr;0612;')).toBe(true);
  });

  it('fileStems are ASCII (Tâches → taches)', () => {
    expect(getDataset('contacts').fileStem).toBe('contacts');
    expect(getDataset('tasks').fileStem).toBe('taches');
    expect(getDataset('scan_leads').fileStem).toBe('stats-scans-leads');
  });

  it('Attribué à resolves the owner id to a display name', () => {
    const nameOf = (id: string) => (id === 'o1' ? 'Eliah' : id);
    const ds = getDataset('contacts', nameOf);
    const row = { ownerId: 'o1', firstName: 'Marie', statut: 'Prospect' } as unknown as ContactStatus;
    const line = toCsv([row], ds.columns).slice(1).split('\r\n')[1];
    expect(line.split(';')[9]).toBe('Eliah'); // "Attribué à" is the 10th column
  });

  it('lists the five datasets in stable order', () => {
    expect(EXPORT_DATASETS.map((d) => d.id)).toEqual(['contacts', 'deals', 'tasks', 'campaigns', 'scan_leads']);
  });
});
