import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Heatmap } from '@/components/charts/Heatmap';
import { buildHeatmap } from '@/lib/analytics/heatmap';
import type { HourlyRow } from '@/lib/analytics/types';

const rows: HourlyRow[] = [
  { dow: 6, hour: 23, scans: 40 },
  { dow: 5, hour: 23, scans: 30 },
  { dow: 2, hour: 12, scans: 6 },
];

describe('Heatmap', () => {
  it('renders a real table so a screen reader can navigate it', () => {
    render(<Heatmap heatmap={buildHeatmap(rows)} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('labels all seven days as row headers', () => {
    render(<Heatmap heatmap={buildHeatmap(rows)} />);
    expect(screen.getAllByRole('rowheader')).toHaveLength(7);
  });

  it('draws all 168 cells', () => {
    const { container } = render(<Heatmap heatmap={buildHeatmap(rows)} />);
    expect(container.querySelectorAll('[data-cell]')).toHaveLength(168);
  });

  // Regression: the visible digit and the sr-only label used to run together
  // in the flattened accessible name (e.g. "1212 h" for the 12 h column),
  // because JSX drops the whitespace-only text node between two sibling
  // expressions. A test that only checked the name was PRESENT would have
  // passed against that broken markup — this pins the exact string.
  it('gives the 12 h column header the accessible name "12 h", not "1212 h"', () => {
    render(<Heatmap heatmap={buildHeatmap(rows)} />);
    expect(screen.getByRole('columnheader', { name: '12 h' })).toBeInTheDocument();
  });

  // The information must not live in the colour alone (WCAG 1.4.1).
  it('gives every cell an accessible description of day, hour and count', () => {
    render(<Heatmap heatmap={buildHeatmap(rows)} />);
    expect(screen.getByLabelText('samedi 23 h — 40 scans')).toBeInTheDocument();
  });

  it('names the peak in words', () => {
    render(<Heatmap heatmap={buildHeatmap(rows)} />);
    expect(screen.getByText(/samedi 23 h/)).toBeInTheDocument();
  });

  it('says nothing about a peak when there is too little data to claim one', () => {
    render(<Heatmap heatmap={buildHeatmap([{ dow: 2, hour: 4, scans: 3 }])} />);
    expect(screen.queryByText(/Votre pic/)).toBeNull();
    expect(screen.getByText(/pas encore assez/i)).toBeInTheDocument();
  });
});
