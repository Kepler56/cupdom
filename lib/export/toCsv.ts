import type { CsvColumn } from '@/types/domain';

const BOM = '﻿';
const SEP = ';'; // Excel-FR default separator (one value per cell, no "Text to Columns")
const EOL = '\r\n'; // RFC-4180

/**
 * Escape a single cell value:
 *  - formula-injection guard: a leading =,+,-,@,TAB,CR gets a `'` prefix (Excel safety),
 *  - quote-wrap iff it contains the separator, a quote, a comma, or a newline; double inner quotes.
 * Exported for unit testing.
 */
export function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[;",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Serialise rows to a CSV string: UTF-8 BOM (Excel renders é/è/à/€), French headers in
 * column order, `;` separator, `\r\n` lines. Does NOT trigger a download.
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(SEP);
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(SEP));
  return BOM + [header, ...body].join(EOL);
}
