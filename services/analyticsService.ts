import {
  Attendance,
  AttendanceHistoryByDate,
  Profile,
  StudentCourseAnalytics,
  StudentGlobalAttendance,
  TeacherDailyAnalytics,
} from '../types';
import { FREQUENT_ABSENT_THRESHOLD } from '../utils/constants';
import { supabase } from '../utils/supabase';
import { teacherService } from './teacherService';

function groupByStudent(records: Attendance[]): Map<string, { present: number; absent: number }> {
  const map = new Map<string, { present: number; absent: number }>();
  for (const r of records) {
    const cur = map.get(r.student_id) ?? { present: 0, absent: 0 };
    if (r.status === 'present') cur.present += 1;
    else cur.absent += 1;
    map.set(r.student_id, cur);
  }
  return map;
}

export const analyticsService = {
  getTeacherDailyAnalytics: async (
    courseId: string,
    date: string
  ): Promise<TeacherDailyAnalytics> => {
    const students = await teacherService.getCourseStudents(courseId);
    const todayRecords = await teacherService.getAttendanceByDate(courseId, date);

    const markedStudentIds = new Set(todayRecords.map((r) => r.student_id));
    const presentToday = todayRecords.filter((r) => r.status === 'present').length;
    const absentToday = todayRecords.filter((r) => r.status === 'absent').length;
    const totalStudents = students.length;
    const markedCount = markedStudentIds.size;
    const attendanceRateToday =
      markedCount > 0 ? Math.round((presentToday / markedCount) * 100) : 0;

    return {
      totalStudents,
      presentToday,
      absentToday,
      attendanceRateToday,
    };
  },

  getStudentAnalyticsForCourse: async (
    courseId: string
  ): Promise<StudentCourseAnalytics[]> => {
    const students = await teacherService.getCourseStudents(courseId);
    const history = await teacherService.getCourseAttendanceHistory(courseId);
    const byStudent = groupByStudent(history);

    return students.map((student: Profile) => {
      const counts = byStudent.get(student.id) ?? { present: 0, absent: 0 };
      const total = counts.present + counts.absent;
      const percentage = total > 0 ? Math.round((counts.present / total) * 100) : 0;
      return {
        student,
        present: counts.present,
        absent: counts.absent,
        percentage,
      };
    });
  },

  getFrequentAbsentees: async (
    courseId: string,
    threshold = FREQUENT_ABSENT_THRESHOLD
  ): Promise<StudentCourseAnalytics[]> => {
    const all = await analyticsService.getStudentAnalyticsForCourse(courseId);
    return all
      .filter((s) => s.absent >= threshold)
      .sort((a, b) => b.absent - a.absent);
  },

  getAttendanceHistoryByDate: async (
    courseId: string
  ): Promise<AttendanceHistoryByDate[]> => {
    const history = await teacherService.getCourseAttendanceHistory(courseId);
    const byDate = new Map<string, { present: number; absent: number }>();

    for (const r of history) {
      const cur = byDate.get(r.date) ?? { present: 0, absent: 0 };
      if (r.status === 'present') cur.present += 1;
      else cur.absent += 1;
      byDate.set(r.date, cur);
    }

    return Array.from(byDate.entries())
      .map(([date, counts]) => ({
        date,
        present: counts.present,
        absent: counts.absent,
        total: counts.present + counts.absent,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  getStudentGlobalAttendance: async (
    studentId: string
  ): Promise<StudentGlobalAttendance> => {
    const { data, error } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentId);

    if (error) throw error;

    const records = data ?? [];
    const totalPresent = records.filter((r) => r.status === 'present').length;
    const totalAbsent = records.filter((r) => r.status === 'absent').length;
    const total = totalPresent + totalAbsent;
    const percentage = total > 0 ? Math.round((totalPresent / total) * 100) : 0;

    return { totalPresent, totalAbsent, percentage };
  },

  verifyTeacherOwnsCourse: async (
    teacherId: string,
    courseId: string
  ): Promise<boolean> => {
    const { data, error } = await supabase
      .from('course_teachers')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('course_id', courseId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },
};
