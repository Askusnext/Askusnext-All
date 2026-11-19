import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export interface HoursRow {
  employeeName: string;
  role: string;
  method: string;
  targetMinutesPerDay: number;
  totalActiveMinutes: number;
  days: { date: string; totalActiveMinutes: number; totalIdleMinutes: number }[];
  weeks: { weekStart: string; activeMinutes: number; targetMinutes: number; metTarget: boolean }[];
}

const hours = (m: number) => Math.round((m / 60) * 100) / 100;
const hhmm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

export async function hoursXlsx(from: string, to: string, rows: HoursRow[], days: string[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AskUs Solutions';

  const sum = wb.addWorksheet('Summary');
  sum.addRow([`Work hours ${from} to ${to}`]).font = { bold: true, size: 14 };
  sum.addRow(['Active time only. Idle time and time the computer was off or locked are not counted.']);
  sum.addRow([]);
  sum.addRow(['Employee', 'Role', 'Tracked by', 'Days with activity', 'Total hours', 'Average hours per active day', 'Target per day (h)', 'Weeks meeting target']).font = { bold: true };
  for (const r of rows) {
    const active = r.days.filter((d) => d.totalActiveMinutes > 0).length;
    const met = r.weeks.filter((w) => w.metTarget).length;
    sum.addRow([r.employeeName, r.role, r.method === 'agent' ? 'Desktop agent' : 'Manual', active, hours(r.totalActiveMinutes), active ? hours(r.totalActiveMinutes / active) : 0, hours(r.targetMinutesPerDay), `${met} of ${r.weeks.length}`]);
  }
  sum.columns.forEach((c, i) => { c.width = i === 0 ? 28 : 18; });

  const grid = wb.addWorksheet('Daily hours');
  grid.addRow(['Employee', ...days.map((d) => d.slice(5)), 'Total']).font = { bold: true };
  for (const r of rows) {
    const by = new Map(r.days.map((d) => [d.date, d.totalActiveMinutes] as const));
    grid.addRow([r.employeeName, ...days.map((d) => (by.get(d) ? hours(by.get(d)!) : '')), hours(r.totalActiveMinutes)]);
  }
  grid.getColumn(1).width = 28;
  grid.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  const weekly = wb.addWorksheet('Weekly vs target');
  weekly.addRow(['Employee', 'Week starting', 'Active hours', 'Target hours', 'Met']).font = { bold: true };
  for (const r of rows) for (const w of r.weeks) weekly.addRow([r.employeeName, w.weekStart, hours(w.activeMinutes), hours(w.targetMinutes), w.targetMinutes === 0 ? 'n/a' : w.metTarget ? 'Yes' : 'No']);
  weekly.getColumn(1).width = 28;
  weekly.getColumn(2).width = 14;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function hoursPdf(from: string, to: string, rows: HoursRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const cols = [{ t: 'Employee', w: 200 }, { t: 'Role', w: 70 }, { t: 'Tracked by', w: 90 }, { t: 'Active days', w: 80 }, { t: 'Total', w: 90 }, { t: 'Avg / active day', w: 100 }, { t: 'Weeks at target', w: 100 }];
    const left = doc.page.margins.left;
    const rowH = 20;
    const header = (y: number) => {
      doc.font('Helvetica-Bold').fontSize(9);
      let x = left;
      for (const c of cols) { doc.text(c.t, x, y + 5, { width: c.w - 4 }); x += c.w; }
      doc.moveTo(left, y + rowH).lineTo(left + cols.reduce((s, c) => s + c.w, 0), y + rowH).strokeColor('#999').stroke();
      return y + rowH + 2;
    };

    doc.font('Helvetica-Bold').fontSize(15).text(`Work hours ${from} to ${to}`, left, doc.page.margins.top);
    doc.font('Helvetica').fontSize(9).fillColor('#555').text('Active time only. Idle time and time the computer was off or locked are not counted.', left, doc.y + 2).fillColor('#000');
    let y = header(doc.y + 10);
    for (const r of rows) {
      if (y > doc.page.height - doc.page.margins.bottom - rowH) { doc.addPage(); y = header(doc.page.margins.top); }
      const active = r.days.filter((d) => d.totalActiveMinutes > 0).length;
      const met = r.weeks.filter((w) => w.metTarget).length;
      const cells = [r.employeeName, r.role, r.method === 'agent' ? 'Desktop agent' : 'Manual', String(active), hhmm(r.totalActiveMinutes), active ? hhmm(Math.round(r.totalActiveMinutes / active)) : '-', `${met} of ${r.weeks.length}`];
      let x = left;
      doc.font('Helvetica').fontSize(9);
      cols.forEach((c, i) => { doc.text(cells[i], x, y + 5, { width: c.w - 6, lineBreak: false, ellipsis: true }); x += c.w; });
      y += rowH;
    }
    doc.end();
  });
}
