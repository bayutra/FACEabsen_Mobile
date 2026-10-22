import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'pdf';

export interface TabularReport {
  title: string;
  generatedAt: string;
  summary: Array<[string, string | number]>;
  headers: string[];
  rows: Array<Array<string | number | null>>;
}

const cell = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  
  
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV (Excel-compatible) with summary preamble. Pure + unit-tested. */
export function toCSV(report: TabularReport): string {
  const lines = [report.title, `Dibuat,${report.generatedAt}`];
  for (const [k, v] of report.summary) lines.push(`${cell(k)},${cell(v)}`);
  lines.push('', report.headers.map(cell).join(','));
  for (const row of report.rows) lines.push(row.map(cell).join(','));
  return lines.join('\n');
}

export async function toXLSX(report: TabularReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Face ID Attendance';
  const ws = wb.addWorksheet('Laporan', {
    views: [{ state: 'frozen', ySplit: report.summary.length + 3 }],
  });
  ws.addRow([report.title]);
  ws.addRow(['Dibuat', report.generatedAt]);
  for (const [k, v] of report.summary) ws.addRow([k, v]);
  ws.addRow([]);
  const header = ws.addRow(report.headers);
  header.font = { bold: true };
  for (const row of report.rows) ws.addRow(row.map((v) => (v === null || v === undefined ? '' : v)));
  ws.columns.forEach((col) => {
    col.width = 22;
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toPDF(report: TabularReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(16).text(report.title);
    doc.fontSize(9).fillColor('gray').text(`Dibuat: ${report.generatedAt}`);
    doc.moveDown(0.5);
    doc.fillColor('black').fontSize(10);
    for (const [k, v] of report.summary) doc.text(`${k}: ${v}`);
    doc.moveDown(0.5);
    doc.font('Courier').fontSize(8);
    const width = 18;
    const line = (cells: Array<string | number | null>) =>
      cells
        .map((c) => String(c ?? '').slice(0, width).padEnd(width))
        .join(' | ');
    doc.text(line(report.headers));
    doc.text('-'.repeat(report.headers.length * (width + 3)));
    for (const row of report.rows) doc.text(line(row));
    doc.end();
  });
}

export const CONTENT_TYPES: Record<Exclude<ExportFormat, 'json'>, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};
