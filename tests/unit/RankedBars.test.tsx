import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RankedBars } from '@/components/charts/RankedBars';
import { buildRanking, UNKNOWN_LABEL } from '@/lib/analytics/ranking';

const ranking = buildRanking([
  { label: 'Paris', scans: 620, uniques: 480 },
  { label: 'Lyon', scans: 240, uniques: 190 },
  { label: 'Marseille', scans: 140, uniques: 120 },
]);

describe('RankedBars', () => {
  it('renders one row per entry with its label, count and share', () => {
    render(<RankedBars ranking={ranking} colour="#003082" />);
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('620', { collapseWhitespace: false })).toBeInTheDocument();
    expect(screen.getByText('62 %', { collapseWhitespace: false })).toBeInTheDocument();
  });

  it('orders the bars by share, widest first', () => {
    const { container } = render(<RankedBars ranking={ranking} colour="#003082" />);
    const widths = [...container.querySelectorAll('[data-bar]')].map(
      (el) => parseFloat((el as HTMLElement).style.width),
    );
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
  });

  // The widest bar is 100 % of the track, not 100 % of the total: a dimension
  // whose leader holds 30 % would otherwise render as three slivers.
  it('scales the widest bar to fill the track', () => {
    const { container } = render(<RankedBars ranking={ranking} colour="#003082" />);
    const first = container.querySelector('[data-bar]') as HTMLElement;
    expect(parseFloat(first.style.width)).toBe(100);
  });

  it('shows people alongside scans when the dimension counts them', () => {
    render(<RankedBars ranking={ranking} colour="#003082" />);
    expect(screen.getByText(/480/)).toBeInTheDocument();
  });

  // The « Autres » row sums per-bucket distinct counts, and one person can sit
  // in two buckets, so its uniques is a ceiling. Printed like the exact rows it
  // would read as a measurement.
  it('marks the rolled-up people count as an approximation', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ label: `V${i}`, scans: 10 - i, uniques: 5 }));
    render(<RankedBars ranking={buildRanking(many, 3)} colour="#003082" />);
    expect(screen.getByText('~15 personnes')).toBeInTheDocument();
    expect(screen.getAllByText('5 personnes')).toHaveLength(3);
  });

  it('omits the people column when the dimension does not count them', () => {
    const noUniques = buildRanking([{ label: 'Mobile', scans: 880 }]);
    render(<RankedBars ranking={noUniques} colour="#003082" />);
    expect(screen.queryByText(/personnes/i)).toBeNull();
  });

  // Spec §4.6-3. « Paris = 60 % » computed on ten scans is arithmetic, not a
  // finding, and the client should be able to see which one they are reading.
  it('warns when the whole ranking rests on too few scans', () => {
    render(<RankedBars ranking={buildRanking([{ label: 'Paris', scans: 6 }])} colour="#003082" />);
    expect(screen.getByText(/trop peu de scans/i)).toBeInTheDocument();
  });

  // The « Comment » card holds four rankings over one denominator, so it states
  // the caveat once itself instead of letting three rankings repeat it beside a
  // donut that never showed it at all.
  it('lets the caller take over the caveat', () => {
    render(
      <RankedBars
        ranking={buildRanking([{ label: 'Paris', scans: 6 }])}
        colour="#003082"
        suppressLowDataNote
      />,
    );
    expect(screen.queryByText(/trop peu de scans/i)).toBeNull();
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });

  it('does not warn once the base is solid', () => {
    render(<RankedBars ranking={ranking} colour="#003082" />);
    expect(screen.queryByText(/trop peu de scans/i)).toBeNull();
  });

  it('renders an empty state rather than an empty list', () => {
    render(<RankedBars ranking={buildRanking([])} colour="#003082" />);
    expect(screen.getByText(/pas encore/i)).toBeInTheDocument();
  });

  // `client_scans_geo` coalesces a null country/region/city to 'Inconnu', so a
  // period where geolocation resolved nothing arrives here as a ranking whose
  // only row is the unknown bucket. `Ranking.empty` exists for exactly that,
  // and the section must not render one full-width bar reading « Inconnu ».
  // The copy is distinct from the no-data state on purpose.
  it('says the information could not be determined when every row is unknown', () => {
    render(
      <RankedBars ranking={buildRanking([{ label: UNKNOWN_LABEL, scans: 500 }])} colour="#003082" />,
    );
    expect(screen.getByText(/pas permis de déterminer/i)).toBeInTheDocument();
    expect(screen.queryByText(UNKNOWN_LABEL)).toBeNull();
    expect(screen.queryByText(/pas encore de données/i)).toBeNull();
  });
});
