import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HistoryItem } from '@/components/molecules/HistoryItem';
import type { HistoryEntry } from '@/types/domain';

vi.mock('@/lib/profiles', () => ({
  useProfiles: () => ({
    profiles: { a1: { id: 'a1', displayName: 'Eliah', color: '#000', email: '' } },
    loading: false,
  }),
}));

const entry: HistoryEntry = {
  id: 'h1', contactId: 'c1', actorId: 'a1', kind: 'task',
  summary: 'Appeler Marie', createdAt: new Date().toISOString(),
};

describe('HistoryItem', () => {
  it('renders the summary, kind icon label, actor and relative time', () => {
    render(<HistoryItem entry={entry} />);
    expect(screen.getByText('Appeler Marie')).toBeInTheDocument();
    expect(screen.getByLabelText('Tâche')).toBeInTheDocument(); // kind → icon label
    expect(screen.getByText(/Eliah/)).toBeInTheDocument();
    expect(screen.getByText(/à l'instant|il y a/)).toBeInTheDocument();
  });

  it('falls back to the kind label when there is no summary', () => {
    render(<HistoryItem entry={{ ...entry, kind: 'transfer', summary: null }} />);
    expect(screen.getAllByText('Transfert').length).toBeGreaterThan(0);
  });
});
