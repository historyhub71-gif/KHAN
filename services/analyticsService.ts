import {
  Attendance,
  AttendanceHistoryByDate,
  CourseAttendanceSummary,
  Profile,
  StudentCourseAnalytics,
  StudentGlobalAttendance,
  TeacherDailyAnalytics,
} from '../types';
import { FREQUENT_ABSENT_THRESHOLD } from '../utils/constants';
import { supabase } from '../utils/supabase';
import { teacherService } from './teacherService';
import { calculateAttendanceStats } from '../utils/attendanceCalculations';

export const analyticsService = {
  getCourseAnalytics: async (
    courseId: string,
    today: string
  ): Promise<{
    dailyStats: TeacherDailyAnalytics;
    courseSummary: CourseAttendanceSummary;
    studentAnalytics: StudentCourseAnalytics[];
    frequentAbsentees: StudentCourseAnalytics[];
    historyByDate: AttendanceHistoryByDate[];
  }> => {
    console.log(`[analyticsService.getCourseAnalytics] Fetching for courseId: ${courseId}`);
    
    // Fetch students and history once
    const enrolledStudents = await teacherService.getCourseStudents(courseId);
    const history = await teacherService.getCourseAttendanceHistory(courseId);

    console.log(`[analyticsService.getCourseAnalytics] Enrolled students count: ${enrolledStudents.length}`);
    console.log(`[analyticsService.getCourseAnalytics] Attendance history records count: ${history.length}`);

    // Build unique map of student profiles using both enrolled students and students from history records
    const studentMap = new Map<string, Profile>();
    for (const student of enrolledStudents) {
      studentMap.set(student.id, student);
    }

    for (const record of history) {
      if (record.student && !studentMap.has(record.student_id)) {
        studentMap.set(record.student_id, record.student);
        console.log(`[analyticsService.getCourseAnalytics] Found unenrolled student with history: ${record.student.name} (${record.student_id})`);
      }
    }

    const students = Array.from(studentMap.values());
    console.log(`[analyticsService.getCourseAnalytics] Total students (enrolled + history-derived): ${students.length}`);

    // 1. Calculate daily stats for today
    const todayRecords = history.filter((r) => r.date === today);
    const todayStats = calculateAttendanceStats(todayRecords);
    const dailyStats: TeacherDailyAnalytics = {
      totalStudents: students.length,
      presentToday: todayStats.present,
      absentToday: todayStats.absent,
      attendanceRateToday: todayStats.percentage,
    };

    // 2. Calculate overall course attendance summary
    const overallStats = calculateAttendanceStats(history);
    const courseSummary: CourseAttendanceSummary = {
      totalStudents: students.length,
      totalPresent: overallStats.present,
      totalAbsent: overallStats.absent,
      overallPercentage: overallStats.percentage,
    };

    // 3. Calculate student analytics
    const studentAnalytics: StudentCourseAnalytics[] = students.map((student: Profile) => {
      const studentHistory = history.filter((r) => r.student_id === student.id);
      const stats = calculateAttendanceStats(studentHistory);
      
      console.log(`[analyticsService.getCourseAnalytics] Student ${student.name} (${student.id}): Present=${stats.present}, Absent=${stats.absent}, Total=${stats.total}, Percentage=${stats.percentage}%`);

      return {
        student,
        present: stats.present,
        absent: stats.absent,
        percentage: stats.percentage,
      };
    });

    // 4. Calculate frequent absentees
    const frequentAbsentees = studentAnalytics
      .filter((s) => s.absent >= FREQUENT_ABSENT_THRESHOLD)
      .sort((a, b) => b.absent - a.absent);

    // 5. Calculate history by date
    const byDate = new Map<string, { present: number; absent: number }>();
    for (const r of history) {
      const cur = byDate.get(r.date) ?? { present: 0, absent: 0 };
      if (r.status === 'present') cur.present += 1;
      else cur.absent += 1;
      byDate.set(r.date, cur);
    }
    const historyByDate: AttendanceHistoryByDate[] = Array.from(byDate.entries())
      .map(([date, counts]) => ({
        date,
        present: counts.present,
        absent: counts.absent,
        total: counts.present + counts.absent,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    console.log(`[analyticsService.getCourseAnalytics] Calculated daily stats:`, dailyStats);
    console.log(`[analyticsService.getCourseAnalytics] Calculated course summary:`, courseSummary);
    console.log(`[analyticsService.getCourseAnalytics] Calculated history by date:`, historyByDate);

    return {
      dailyStats,
      courseSummary,
      studentAnalytics,
      frequentAbsentees,
      historyByDate,
    };
  },

  getTeacherDailyAnalytics: async (
    courseId: string,
    date: string
  ): Promise<TeacherDailyAnalytics> => {
    const students = await teacherService.getCourseStudents(courseId);
    const todayRecords = await teacherService.getAttendanceByDate(courseId, date);

    const stats = calculateAttendanceStats(todayRecords);
    const totalStudents = students.length;

    return {
      totalStudents,
      presentToday: stats.present,
      absentToday: stats.absent,
      attendanceRateToday: stats.percentage,
    };
  },

  getStudentAnalyticsForCourse: async (
    courseId: string
  ): Promise<StudentCourseAnalytics[]> => {
    const students = await teacherService.getCourseStudents(courseId);
    const history = await teacherService.getCourseAttendanceHistory(courseId);

    return students.map((student: Profile) => {
      const studentHistory = history.filter((r) => r.student_id === student.id);
      const stats = calculateAttendanceStats(studentHistory);
      return {
        student,
        present: stats.present,
        absent: stats.absent,
        percentage: stats.percentage,
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

    const stats = calculateAttendanceStats((data || []) as Attendance[]);
    return {
      totalPresent: stats.present,
      totalAbsent: stats.absent,
      percentage: stats.percentage,
    };
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
