import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportButton } from '@/components/molecules/ExportButton';
import { downloadCsv } from '@/lib/export/downloadCsv';

vi.mock('@/lib/scope', () => ({ useScope: () => ({ scope: { kind: 'all' }, setScope: () => {}, myId: null }) }));
vi.mock('@/lib/profiles', () => ({ useProfiles: () => ({ profiles: {}, loading: false }) }));
vi.mock('@/lib/export/downloadCsv', () => ({ downloadCsv: vi.fn() }));

type Row = { firstName: string; ownerId: string; statut: string };
const rows: Row[] = [
  { firstName: 'A', ownerId: 'o1', statut: 'Prospect' },
  { firstName: 'B', ownerId: 'o1', statut: 'Client' },
];

describe('ExportButton', () => {
  beforeEach(() => (downloadCsv as Mock).mockClear());

  it('lists all five datasets; ones not in this mount are disabled (no download on click)', () => {
    render(<ExportButton datasetId="contacts" rows={rows} />);
    fireEvent.click(screen.getByRole('button', { name: /Exporter/ }));
    for (const label of ['Contacts', 'Deals', 'Tâches', 'Campagnes', 'Stats scans-leads']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Since Spec 3A every dataset is available; entries not in this mount's allowed set stay disabled.
    expect(screen.queryByText('bientôt')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Campagnes')); // not in allowed set → disabled
    expect(downloadCsv).not.toHaveBeenCalled();
  });

  it('exporting Contacts downloads a BOM CSV named contacts_tous_<date>.csv mirroring the rows', () => {
    render(<ExportButton datasetId="contacts" rows={rows} />);
    fireEvent.click(screen.getByRole('button', { name: /Exporter/ }));
    fireEvent.click(screen.getByText('Contacts'));

    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [filename, csv] = (downloadCsv as Mock).mock.calls[0] as [string, string];
    expect(filename).toMatch(/^contacts_tous_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const bodyLines = csv.slice(1).split('\r\n').slice(1); // drop BOM + header
    expect(bodyLines).toHaveLength(rows.length); // export mirrors visible rows, no re-filter
  });

  it('empty rows → no download, shows "Aucune donnée à exporter"', () => {
    render(<ExportButton datasetId="contacts" rows={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Exporter/ }));
    fireEvent.click(screen.getByText('Contacts'));
    expect(downloadCsv).not.toHaveBeenCalled();
    expect(screen.getByText('Aucune donnée à exporter')).toBeInTheDocument();
  });
});
