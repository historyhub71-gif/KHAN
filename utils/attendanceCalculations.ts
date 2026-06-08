import { Attendance, AttendanceStats } from '../types';

export function calculateAttendanceStats(records: Attendance[]): AttendanceStats {
  const activeRecords = records.filter((r) => r.status === 'present' || r.status === 'absent');
  const total = activeRecords.length;
  const present = activeRecords.filter((r) => r.status === 'present').length;
  const absent = activeRecords.filter((r) => r.status === 'absent').length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
  return { total, present, absent, percentage };
}
