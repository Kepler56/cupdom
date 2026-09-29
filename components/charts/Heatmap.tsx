import { DOW_LABELS, DOW_LABELS_LONG, type Heatmap as HeatmapModel } from '@/lib/analytics/heatmap';

/**
 * The signature visual: 7 days × 24 hours, heure de Paris.
 *
 * A real <table> with row and column headers, not a grid of divs — this IS
 * tabular data, and the markup should say so. Colour never carries the message
 * on its own: each cell's aria-label states the day, the hour and the count,
 * and the weekday and hourly charts beside it repeat the same data with no hue
 * at all (WCAG 1.4.1).
 */
export function Heatmap({ heatmap }: { heatmap: HeatmapModel }) {
  const hours = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-[2px]">
          <caption className="sr-only">
            Scans par jour de la semaine et par heure, heure de Paris.
          </caption>
          <thead>
            <tr>
              <th className="w-10">
                <span className="sr-only">Jour</span>
              </th>
              {hours.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="text-[10px] font-normal text-text-muted"
                >
                  <span aria-hidden="true">{h % 3 === 0 ? h : ''}</span>
                  <span className="sr-only">{h} h</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOW_LABELS.map((day, index) => (
              <tr key={day}>
                <th scope="row" className="pr-2 text-right text-xs font-normal text-text-muted">
                  <span aria-hidden="true">{day}</span>
                  <span className="sr-only">{DOW_LABELS_LONG[index]}</span>
                </th>
                {hours.map((h) => {
                  const cell = heatmap.cells[index * 24 + h];
                  return (
                    <td key={h} className="p-0" aria-label={cell.title}>
                      <div
                        data-cell
                        title={cell.title}
                        className="h-5 w-full rounded-[3px]"
                        style={{ backgroundColor: cell.colour }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {heatmap.peak ? (
        <p className="mt-4 rounded-[var(--radius-card)] bg-canvas p-3 text-sm text-text-body">
          Votre pic : <strong>{heatmap.peak.label}</strong> — {heatmap.peak.scansLabel} scans.
        </p>
      ) : (
        <p className="mt-4 text-sm text-text-muted">
          Pas encore assez de scans pour dégager une heure forte.
        </p>
      )}
    </div>
  );
}
