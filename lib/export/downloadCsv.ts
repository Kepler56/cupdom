/** Trigger a browser download of a CSV string (BOM already included). Client-only. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') {
    throw new Error('downloadCsv must run in the browser (client component / event handler).');
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
