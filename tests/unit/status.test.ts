import { describe, expect, it } from 'vitest';
import { deriveStatut, STATUT_TONE } from '@/lib/status';
import type { DealStage } from '@/types/domain';

const d = (...stages: DealStage[]) => stages.map((stage) => ({ stage }));

describe('deriveStatut (mirrors contacts_with_status SQL view)', () => {
  it('any GAGNÉ → Client (wins over everything)', () => {
    expect(deriveStatut(d('GAGNÉ'))).toBe('Client');
    expect(deriveStatut(d('GAGNÉ', 'NÉGOCIATION'))).toBe('Client');
    expect(deriveStatut(d('PERDU', 'GAGNÉ'))).toBe('Client');
  });

  it('any active (QUALIFICATION/PROPOSITION/NÉGOCIATION) and no GAGNÉ → En cours', () => {
    expect(deriveStatut(d('NÉGOCIATION'))).toBe('En cours');
    expect(deriveStatut(d('QUALIFICATION', 'PERDU'))).toBe('En cours');
    expect(deriveStatut(d('PROPOSITION'))).toBe('En cours');
  });

  it('only PERDU deals → Perdu', () => {
    expect(deriveStatut(d('PERDU'))).toBe('Perdu');
    expect(deriveStatut(d('PERDU', 'PERDU'))).toBe('Perdu');
  });

  it('no deals → Prospect', () => {
    expect(deriveStatut([])).toBe('Prospect');
  });

  it('maps every statut to a tone', () => {
    expect(STATUT_TONE).toEqual({
      Prospect: 'neutral',
      'En cours': 'info',
      Client: 'success',
      Perdu: 'danger',
    });
  });
});
