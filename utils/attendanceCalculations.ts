import { Attendance, AttendanceStats } from '../types';

export function calculateAttendanceStats(records: Attendance[]): AttendanceStats {
  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const absent = total - present;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
  return { total, present, absent, percentage };
}
