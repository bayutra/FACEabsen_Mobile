import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  MAX_EXPORT_ROWS,
  toCSV,
  toPDF,
  toXLSX,
  type TabularReport,
} from './export.js';

const report: TabularReport = {
  title: 'Laporan Harian 2026-10-05',
  generatedAt: '2026-10-05T00:00:00.000Z',
  summary: [['Hadir', 3]],
  headers: ['NIP', 'Nama, lengkap', 'Status'],
  rows: [
    ['EMP-001', 'Siti "Siaga"', 'ON_TIME'],
    ['EMP-002', null, 'LATE'],
  ],
};

describe('export renderers', () => {
  it('CSV escapes commas/quotes and carries summary', () => {
    const csv = toCSV(report);
    expect(csv).toContain('"Nama, lengkap"');
    expect(csv).toContain('"Siti ""Siaga"""');
    expect(csv).toContain('Hadir,3');
  });

  it('CSV neutralizes formula injection with a leading single-quote', () => {
    const evil: TabularReport = {
      title: 'Laporan',
      generatedAt: '2026-10-05T00:00:00.000Z',
      summary: [],
      headers: ['Nama'],
      rows: [
        ["=cmd|'/c calc'!A0"],
        ['+1+1'],
        ['-2+3'],
        ['@SUM(A1:A2)'],
        ['\t=HYPERLINK("http://evil")'],
      ],
    };
    const csv = toCSV(evil);

    expect(csv).toContain("'=cmd|'/c calc'!A0");
    expect(csv).toContain("'+1+1");
    expect(csv).toContain("'-2+3");
    expect(csv).toContain("'@SUM(A1:A2)");

    expect(csv).toContain(`"'\t=HYPERLINK`);

    expect(toCSV(report)).not.toContain("'Siti");
  });

  it('XLSX neutralizes formula injection', async () => {
    const evil: TabularReport = {
      title: 'Laporan',
      generatedAt: '2026-10-05T00:00:00.000Z',
      summary: [],
      headers: ['Nama'],
      rows: [['=1+1'], ['+cmd'], ['-2'], ['@SUM(A1)']],
    };
    const buf = await toXLSX(evil);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('Laporan');
    const values: string[] = [];
    ws?.eachRow((row) => {
      row.eachCell((cell) => values.push(String(cell.text)));
    });
    expect(values).toContain("'=1+1");
    expect(values).toContain("'+cmd");
    expect(values).toContain("'-2");
    expect(values).toContain("'@SUM(A1)");
  });

  it('rejects oversized reports (row cap) with HTTP 413', async () => {
    const huge: TabularReport = {
      title: 'Laporan',
      generatedAt: '2026-10-05T00:00:00.000Z',
      summary: [],
      headers: ['NIP'],
      rows: Array.from({ length: MAX_EXPORT_ROWS + 1 }, (_, i) => [
        `EMP-${i}`,
      ]),
    };
    await expect(toXLSX(huge)).rejects.toMatchObject({
      status: 413,
      response: { reason: 'EXPORT_TOO_LARGE' },
    });
    expect(() => toCSV(huge)).toThrowError(/10,000|EXPORT_TOO_LARGE|dibatasi/);
  });

  it('XLSX roundtrips headers + rows', async () => {
    const buf = await toXLSX(report);
    expect(buf.length).toBeGreaterThan(1000);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('Laporan');
    const values: string[] = [];
    ws?.eachRow((row) => {
      row.eachCell((cell) => values.push(String(cell.text)));
    });
    expect(values).toContain('NIP');
    expect(values).toContain('EMP-001');
    expect(values).toContain('Siti "Siaga"');
  });

  it('PDF starts with magic + title', async () => {    const buf = await toPDF(report);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });
});
