import {
  Attendance,
  MonthlyAttendanceSummary,
  Profile,
  StudentAttendanceReport,
} from '../types';
import {
  APP_NAME,
  FREQUENT_ABSENT_THRESHOLD,
} from '../utils/constants';
import { supabase } from '../utils/supabase';
import { analyticsService } from './analyticsService';
import { teacherService } from './teacherService';

function computeStats(records: Attendance[]) {
  const present = records.filter((r) => r.status === 'present').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const total = present + absent;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
  return { total, present, absent, percentage };
}

function buildMonthlySummaries(records: Attendance[]): MonthlyAttendanceSummary[] {
  const byMonth = new Map<string, { present: number; absent: number; year: number; monthIndex: number }>();

  for (const r of records) {
    const d = new Date(r.date + 'T12:00:00');
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const key = `${year}-${monthIndex}`;
    const cur = byMonth.get(key) ?? { present: 0, absent: 0, year, monthIndex };
    if (r.status === 'present') cur.present += 1;
    else cur.absent += 1;
    byMonth.set(key, cur);
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return Array.from(byMonth.values())
    .map((v) => {
      const total = v.present + v.absent;
      return {
        month: `${monthNames[v.monthIndex]} ${v.year}`,
        year: v.year,
        monthIndex: v.monthIndex,
        present: v.present,
        absent: v.absent,
        percentage: total > 0 ? Math.round((v.present / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.year - a.year || b.monthIndex - a.monthIndex);
}

async function assertTeacherCanAccessStudent(
  teacherId: string,
  courseId: string,
  studentId: string
): Promise<void> {
  const owns = await analyticsService.verifyTeacherOwnsCourse(teacherId, courseId);
  if (!owns) {
    throw new Error('You are not assigned to this course.');
  }

  const students = await teacherService.getCourseStudents(courseId);
  if (!students.some((s) => s.id === studentId)) {
    throw new Error('This student is not enrolled in this course.');
  }
}

export const reportService = {
  getStudentAttendanceReport: async (
    teacherId: string,
    courseId: string,
    studentId: string
  ): Promise<StudentAttendanceReport> => {
    await assertTeacherCanAccessStudent(teacherId, courseId, studentId);

    const [course, students, teacherResult, history] = await Promise.all([
      teacherService.getCourse(courseId),
      teacherService.getCourseStudents(courseId),
      supabase.from('profiles').select('*').eq('id', teacherId).single(),
      teacherService.getStudentAttendanceInCourse(courseId, studentId),
    ]);

    const student = students.find((s) => s.id === studentId);
    if (!student) {
      throw new Error('Student not found in this course.');
    }

    if (teacherResult.error) {
      throw teacherResult.error;
    }

    const stats = computeStats(history);

    return {
      appName: APP_NAME,
      student,
      course,
      teacher: teacherResult.data as Profile,
      stats,
      history,
      monthlySummaries: buildMonthlySummaries(history),
      frequentAbsentWarning: stats.absent >= FREQUENT_ABSENT_THRESHOLD,
      generatedAt: new Date().toISOString(),
    };
  },
};
