import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { AttendanceStatus } from './leave.entities';

export interface RegisterData {
  month: string;
  days: string[];
  rows: {
    employeeName: string;
    role: string;
    cells: { s: AttendanceStatus | null; late: number; miss: boolean }[];
    summary: { present: number; halfDay: number; absent: number; onLeave: number; holiday: number; weekOff: number; lateCount: number; lateMinutes: number; missedCheckouts: number };
  }[];
}

export interface LateData { people: { employeeName: string; count: number; totalMinutes: number }[] }
export interface BalanceData { year: number; types: string[]; rows: { employeeName: string; balances: { leaveType: string; totalAllotted: number | null; used: number; remaining: number | null }[] }[] }

const CODE: Record<AttendanceStatus, string> = { Present: 'P', Absent: 'A', HalfDay: 'HD', OnLeave: 'L', Holiday: 'H', WeekOff: 'WO' };
export const cellCode = (c: { s: AttendanceStatus | null; late: number }) => (c.s ? CODE[c.s] + (c.late > 0 ? '*' : '') : '-');

export async function registerXlsx(reg: RegisterData, late: LateData, bal: BalanceData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AskUs Solutions';

  const sheet = wb.addWorksheet('Attendance register');
  sheet.addRow([`Attendance register - ${reg.month}`]).font = { bold: true, size: 14 };
  sheet.addRow(['P present, A absent, HD half-day, L on leave, H holiday, WO week-off, * late, - not marked']);
  sheet.addRow([]);
  const head = sheet.addRow(['Employee', 'Role', ...reg.days.map((d) => Number(d.slice(8))), 'Present', 'Half-day', 'Absent', 'On leave', 'Late (times)', 'Late (min)']);
  head.font = { bold: true };
  for (const r of reg.rows) {
    const s = r.summary;
    sheet.addRow([r.employeeName, r.role, ...r.cells.map(cellCode), s.present, s.halfDay, s.absent, s.onLeave, s.lateCount, s.lateMinutes]);
  }
  sheet.getColumn(1).width = 26;
  sheet.getColumn(2).width = 10;
  reg.days.forEach((_, i) => { sheet.getColumn(i + 3).width = 4.5; });
  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];

  const lateSheet = wb.addWorksheet('Late arrivals');
  lateSheet.addRow(['Employee', 'Times late', 'Total minutes late']).font = { bold: true };
  for (const p of late.people) lateSheet.addRow([p.employeeName, p.count, p.totalMinutes]);
  lateSheet.columns.forEach((c, i) => { c.width = i === 0 ? 28 : 18; });

  const balSheet = wb.addWorksheet(`Leave balance ${bal.year}`);
  balSheet.addRow(['Employee', ...bal.types.flatMap((t) => [`${t} used`, `${t} left`])]).font = { bold: true };
  for (const r of bal.rows) {
    balSheet.addRow([r.employeeName, ...bal.types.flatMap((t) => {
      const b = r.balances.find((x) => x.leaveType === t);
      return [b?.used ?? 0, b?.remaining ?? 'n/a'];
    })]);
  }
  balSheet.getColumn(1).width = 28;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function registerPdf(reg: RegisterData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 28 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const nameW = 150, cellW = 24, sumW = 30, rowH = 16;
    const sumCols = ['P', 'HD', 'A', 'L', 'Late'];
    const left = doc.page.margins.left;
    const bottom = () => doc.page.height - doc.page.margins.bottom - rowH;

    const header = (y: number) => {
      doc.font('Helvetica-Bold').fontSize(8);
      doc.text('Employee', left, y + 4, { width: nameW });
      reg.days.forEach((d, i) => doc.text(String(Number(d.slice(8))), left + nameW + i * cellW, y + 4, { width: cellW, align: 'center' }));
      sumCols.forEach((c, i) => doc.text(c, left + nameW + reg.days.length * cellW + i * sumW, y + 4, { width: sumW, align: 'center' }));
      doc.moveTo(left, y + rowH).lineTo(left + nameW + reg.days.length * cellW + sumCols.length * sumW, y + rowH).strokeColor('#999').stroke();
      return y + rowH + 2;
    };

    doc.font('Helvetica-Bold').fontSize(14).text(`Attendance register - ${reg.month}`, left, doc.page.margins.top);
    doc.font('Helvetica').fontSize(8).fillColor('#555').text('P present, A absent, HD half-day, L on leave, H holiday, WO week-off, * late, - not marked', left, doc.y + 2);
    doc.fillColor('#000');
    let y = header(doc.y + 8);

    for (const r of reg.rows) {
      if (y > bottom()) { doc.addPage(); y = header(doc.page.margins.top); }
      doc.font('Helvetica').fontSize(8).text(r.employeeName, left, y + 4, { width: nameW - 6, lineBreak: false, ellipsis: true });
      r.cells.forEach((c, i) => {
        if (c.s === 'Absent') doc.fillColor('#c0392b');
        else if (c.s === 'Holiday' || c.s === 'WeekOff') doc.fillColor('#888');
        doc.text(cellCode(c), left + nameW + i * cellW, y + 4, { width: cellW, align: 'center', lineBreak: false });
        doc.fillColor('#000');
      });
      const s = r.summary;
      [s.present, s.halfDay, s.absent, s.onLeave, s.lateCount].forEach((v, i) =>
        doc.text(String(v), left + nameW + reg.days.length * cellW + i * sumW, y + 4, { width: sumW, align: 'center', lineBreak: false }));
      y += rowH;
    }
    doc.end();
  });
}
