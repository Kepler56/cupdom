import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from '@/components/molecules/KpiCard';
import type { KpiCardData } from '@/types/domain';

const card = (over: Partial<KpiCardData> = {}): KpiCardData => ({
  key: 'scans_30j',
  label: 'Scans (30 j)',
  value: '120',
  trendPct: 20,
  ...over,
});

describe('KpiCard', () => {
  it('renders the value and label', () => {
    render(<KpiCard data={card()} />);
    expect(screen.getByText('Scans (30 j)')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('trend tone: +→success, −→danger, 0→neutral', () => {
    const { rerender } = render(<KpiCard data={card({ trendPct: 20 })} />);
    expect(screen.getByText('+20 %').className).toContain('bg-success-bg');
    rerender(<KpiCard data={card({ trendPct: -8 })} />);
    expect(screen.getByText('−8 %').className).toContain('bg-danger-bg');
    rerender(<KpiCard data={card({ trendPct: 0 })} />);
    expect(screen.getByText('0 %').className).toContain('bg-border'); // neutral
  });

  it('trend hidden when trendPct is null (pipeline card)', () => {
    render(<KpiCard data={card({ key: 'pipeline_eur', label: 'Pipeline', value: '25 000 €', trendPct: null })} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('sparkline hidden when no series (< 2 points)', () => {
    const { container } = render(<KpiCard data={card({ trendSeries: [1] })} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('sparkline renders with a series', () => {
    const { container } = render(<KpiCard data={card({ trendSeries: [1, 4, 2, 6] })} />);
    expect(container.querySelector('svg polyline')).not.toBeNull();
  });
});
