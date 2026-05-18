import { StudentAttendanceReport } from '../types';
import { APP_TAGLINE } from './constants';
import { DateHelpers } from './dateHelpers';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadge(status: string): string {
  const isPresent = status === 'present';
  const bg = isPresent ? '#d1fae5' : '#fee2e2';
  const color = isPresent ? '#065f46' : '#991b1b';
  const label = isPresent ? 'Present' : 'Absent';
  return (
    '<span style="background:' +
    bg +
    ';color:' +
    color +
    ';padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700;">' +
    label +
    '</span>'
  );
}

function buildMonthlyChartHtml(report: StudentAttendanceReport): string {
  if (report.monthlySummaries.length === 0) {
    return '<p class="muted">No monthly data yet.</p>';
  }

  const bars = report.monthlySummaries.slice(0, 6).map((m) => {
    const height = Math.max(8, m.percentage);
    const shortMonth = escapeHtml(m.month.split(' ')[0].slice(0, 3));
    return (
      '' +
      '<div class="bar-col">' +
      '<div class="bar" style="height:' +
      height +
      '%;"></div>' +
      '<div class="bar-label">' +
      shortMonth +
      '</div><div class="bar-pct">' +
      m.percentage +
      '%</div></div>'
    );
  });

  return '<div class="chart">' + bars.join('') + '</div>';
}

function buildMonthlyTableHtml(report: StudentAttendanceReport): string {
  if (report.monthlySummaries.length === 0) {
    return '<tr><td colspan="4" class="muted">No records</td></tr>';
  }
  return report.monthlySummaries
    .map((m) => {
      return (
        '<tr><td>' +
        escapeHtml(m.month) +
        '</td><td>' +
        m.present +
        '</td><td>' +
        m.absent +
        '</td><td><strong>' +
        m.percentage +
        '%</strong></td></tr>'
      );
    })
    .join('');
}

function buildHistoryTableHtml(report: StudentAttendanceReport): string {
  if (report.history.length === 0) {
    return '<tr><td colspan="3" class="muted">No attendance records yet</td></tr>';
  }
  return report.history
    .map((row) => {
      return (
        '<tr><td>' +
        DateHelpers.formatDate(row.date) +
        '</td><td>' +
        DateHelpers.getDayName(DateHelpers.parseDate(row.date)) +
        '</td><td>' +
        statusBadge(row.status) +
        '</td></tr>'
      );
    })
    .join('');
}

function stripPlaceholders(html: string): string {
  return html.replace(/<\/?motion-disabled>/g, '');
}

export function buildAttendanceReportHtml(
  report: StudentAttendanceReport,
  logoDataUri?: string
): string {
  const generated = DateHelpers.formatDate(report.generatedAt);
  const studentIdShort = report.student.id.slice(0, 8).toUpperCase();

  let warningHtml = '';
  if (report.frequentAbsentWarning) {
    warningHtml =
      '<div class="warning"><strong>Attendance warning:</strong> This student has ' +
      String(report.stats.absent) +
      ' absences. Please follow up with the student and parent.</div>';
  }

  const logoBlock = logoDataUri
    ? '<img src="' + logoDataUri + '" class="logo" alt="Logo" />'
    : '<div class="logo-fallback">HK</div>';

  const parts: string[] = [];
  parts.push('<!DOCTYPE html><html><head><meta charset="utf-8" /><style>');
  parts.push(
    'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1c1c1e;margin:0;padding:32px;font-size:12px;}'
  );
  parts.push(
    '.header{display:flex;align-items:center;gap:16px;border-bottom:3px solid #007AFF;padding-bottom:16px;margin-bottom:24px;}'
  );
  parts.push('.logo{width:56px;height:56px;border-radius:12px;}');
  parts.push(
    '.logo-fallback{width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#007AFF,#5856D6);color:#fff;font-weight:800;font-size:20px;text-align:center;line-height:56px;}'
  );
  parts.push('.school h1{margin:0;font-size:22px;color:#007AFF;}');
  parts.push('.school p{margin:4px 0 0;color:#6c757d;font-size:11px;}');
  parts.push('.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;}');
  parts.push(
    '.meta-card{background:#f8f9fa;border:1px solid #e9ecef;border-radius:10px;padding:12px 14px;}'
  );
  parts.push(
    '.meta-card label{display:block;font-size:10px;text-transform:uppercase;color:#6c757d;font-weight:700;}'
  );
  parts.push('.meta-card span{font-size:14px;font-weight:700;}');
  parts.push('.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}');
  parts.push('.stat{text-align:center;padding:14px 8px;border-radius:10px;border:1px solid #e9ecef;}');
  parts.push('.stat .val{font-size:22px;font-weight:800;}');
  parts.push(
    '.stat .lbl{font-size:10px;color:#6c757d;text-transform:uppercase;font-weight:600;margin-top:4px;}'
  );
  parts.push('.stat.present .val{color:#34C759;}');
  parts.push('.stat.absent .val{color:#FF3B30;}');
  parts.push('.stat.rate .val{color:#007AFF;}');
  parts.push(
    '.warning{background:#fff3cd;border:1px solid #ffc107;color:#856404;padding:12px;border-radius:10px;margin-bottom:20px;}'
  );
  parts.push('h2{font-size:14px;margin:24px 0 12px;border-left:4px solid #007AFF;padding-left:10px;}');
  parts.push(
    '.chart{display:flex;align-items:flex-end;gap:12px;height:120px;padding:12px;background:#f8f9fa;border-radius:10px;border:1px solid #e9ecef;}'
  );
  parts.push('.bar-col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;}');
  parts.push(
    '.bar{width:100%;max-width:36px;background:linear-gradient(180deg,#007AFF,#5856D6);border-radius:6px 6px 0 0;margin-top:auto;min-height:8px;}'
  );
  parts.push('.bar-label{font-size:10px;color:#6c757d;margin-top:6px;font-weight:600;}');
  parts.push('.bar-pct{font-size:9px;color:#007AFF;font-weight:700;}');
  parts.push('table{width:100%;border-collapse:collapse;margin-bottom:16px;}');
  parts.push(
    'th{background:#007AFF;color:#fff;text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;}'
  );
  parts.push('td{padding:10px 12px;border-bottom:1px solid #e9ecef;}');
  parts.push('tr:nth-child(even) td{background:#f8f9fa;}');
  parts.push('.muted{color:#6c757d;text-align:center;}');
  parts.push(
    '.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e9ecef;text-align:center;color:#6c757d;font-size:10px;}'
  );
  parts.push('</style></head><body>');

  parts.push('<div class="header">' + logoBlock);
  parts.push('<div class="school"><h1>' + escapeHtml(report.appName) + '</h1>');
  parts.push('<p>' + escapeHtml(APP_TAGLINE) + '</p></div></div>');

  parts.push('<div class="meta-grid">');
  parts.push(
    '<div class="meta-card"><label>Student</label><span>' +
      escapeHtml(report.student.name) +
      '</span></div>'
  );
  parts.push('<div class="meta-card"><label>Student ID</label><span>' + studentIdShort + '</span></div>');
  parts.push(
    '<div class="meta-card"><label>Course</label><span>' +
      escapeHtml(report.course.name) +
      ' (' +
      escapeHtml(report.course.code) +
      ')</span></div>'
  );
  parts.push(
    '<div class="meta-card"><label>Teacher</label><span>' +
      escapeHtml(report.teacher.name) +
      '</span></div>'
  );
  parts.push('<div class="meta-card"><label>Generated</label><span>' + generated + '</span></div>');
  parts.push('</div>');

  parts.push('<div class="stats">');
  parts.push(
    '<div class="stat rate"><div class="val">' +
      report.stats.percentage +
      '%</div><div class="lbl">Attendance</div></div>'
  );
  parts.push(
    '<div class="stat present"><div class="val">' +
      report.stats.present +
      '</div><div class="lbl">Present</div></div>'
  );
  parts.push(
    '<div class="stat absent"><div class="val">' +
      report.stats.absent +
      '</div><div class="lbl">Absent</div></div>'
  );
  parts.push(
    '<div class="stat"><div class="val">' +
      report.stats.total +
      '</div><div class="lbl">Total days</div></div>'
  );
  parts.push('</div>');

  parts.push(warningHtml);
  parts.push('<h2>Monthly attendance chart</h2>');
  parts.push(buildMonthlyChartHtml(report));
  parts.push('<h2>Monthly summary</h2>');
  parts.push('<table><thead><tr><th>Month</th><th>Present</th><th>Absent</th><th>Rate</th></tr></thead><tbody>');
  parts.push(buildMonthlyTableHtml(report));
  parts.push('</tbody></table>');
  parts.push('<h2>Attendance history</h2>');
  parts.push('<table><thead><tr><th>Date</th><th>Day</th><th>Status</th></tr></thead><tbody>');
  parts.push(buildHistoryTableHtml(report));
  parts.push('</tbody></table>');
  parts.push(
    '<div class="footer">' +
      escapeHtml(report.appName) +
      ' · Confidential attendance report · ' +
      generated +
      '</div>'
  );
  parts.push('</body></html>');

  return stripPlaceholders(parts.join(''));
}
