import { describe, expect, it } from 'vitest';
import { escapeCell, toCsv } from '@/lib/export/toCsv';
import type { CsvColumn } from '@/types/domain';

type Row = { a: string | number | null | undefined; b: string | null };
const cols: CsvColumn<Row>[] = [
  { header: 'Prénom', value: (r) => r.a },
  { header: 'Nom', value: (r) => r.b },
];

describe('escapeCell', () => {
  it('null/undefined → empty', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
  });
  it('quote-wraps separator/comma/quote/newline', () => {
    expect(escapeCell('Dupont; SARL')).toBe('"Dupont; SARL"');
    expect(escapeCell('a,b')).toBe('"a,b"');
    expect(escapeCell('Pain "au" choc')).toBe('"Pain ""au"" choc"');
    expect(escapeCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('formula-injection guard prefixes a quote', () => {
    expect(escapeCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCell('+1')).toBe("'+1");
    expect(escapeCell('@cmd')).toBe("'@cmd");
  });
});

describe('toCsv', () => {
  it('empty rows → BOM + header only', () => {
    const csv = toCsv<Row>([], cols);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('﻿Prénom;Nom');
  });
  it('starts with the BOM and the FR header row in column order', () => {
    const csv = toCsv<Row>([{ a: 'Marie', b: 'Curie' }], cols);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [header, line] = csv.slice(1).split('\r\n');
    expect(header).toBe('Prénom;Nom');
    expect(line).toBe('Marie;Curie');
  });
  it('null/undefined accessors render as empty cells', () => {
    const csv = toCsv<Row>([{ a: null, b: null }], cols);
    expect(csv.slice(1).split('\r\n')[1]).toBe(';');
  });
  it('escapes cells containing the separator', () => {
    const csv = toCsv<Row>([{ a: 'X; Y', b: 'Z' }], cols);
    expect(csv).toContain('"X; Y";Z');
  });
});
