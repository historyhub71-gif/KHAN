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
      else if (r.status === 'absent') cur.absent += 1;
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
      else if (r.status === 'absent') cur.absent += 1;
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

  getAdminInterviewAnalytics: async () => {
    // 1. Level Counts
    const { data: levelData, error: levelErr } = await supabase
      .from('interviews')
      .select('assigned_level')
      .eq('interview_type', 'admission')
      .is('deleted_at', null);

    if (levelErr) throw levelErr;

    const levels = { Beginner: 0, Intermediate: 0, Advanced: 0 };
    (levelData || []).forEach((i: any) => {
      const lvl = i.assigned_level as 'Beginner' | 'Intermediate' | 'Advanced';
      if (lvl && levels[lvl] !== undefined) {
        levels[lvl]++;
      }
    });

    // 2. Growth Tracking Reviews List
    const { data: growthReviews, error: growthErr } = await supabase
      .from('interviews')
      .select('id, created_at, total_score, student:student_id(name), interviewer:interviewer_id(name)')
      .eq('interview_type', 'progress_review')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (growthErr) throw growthErr;

    const growthTracking = (growthReviews || []).map((r: any) => ({
      id: r.id,
      date: r.created_at,
      score: r.total_score,
      studentName: r.student?.name || 'Unknown Student',
      interviewerName: r.interviewer?.name || 'Unknown ASR',
    }));

    // 3. Teacher Performance Parameters
    const { data: progressReports, error: reportsErr } = await supabase
      .from('student_progress_reports')
      .select('teacher_id, improvement_percentage, teacher:teacher_id(name)');

    if (reportsErr) throw reportsErr;

    const teacherPerformanceMap: Record<string, { name: string; totalImprovement: number; count: number }> = {};
    (progressReports || []).forEach((pr: any) => {
      const teacherId = pr.teacher_id;
      if (!teacherId) return;
      const teacherName = pr.teacher?.name || 'Unknown Teacher';
      if (!teacherPerformanceMap[teacherId]) {
        teacherPerformanceMap[teacherId] = { name: teacherName, totalImprovement: 0, count: 0 };
      }
      teacherPerformanceMap[teacherId].totalImprovement += Number(pr.improvement_percentage || 0);
      teacherPerformanceMap[teacherId].count++;
    });

    const teacherPerformance = Object.values(teacherPerformanceMap).map((tp) => ({
      name: tp.name,
      averageImprovement: tp.count > 0 ? (tp.totalImprovement / tp.count) : 0,
      reportsCount: tp.count,
    }));

    // 4. Fortnight Review Metrics
    const { data: fortnightData, error: fortnightErr } = await supabase
      .from('fortnight_reviews')
      .select('completed_at');

    if (fortnightErr) throw fortnightErr;

    const totalFortnightReviews = fortnightData?.length || 0;
    const completedFortnightReviews = fortnightData?.filter((fr: any) => fr.completed_at !== null).length || 0;
    const pendingFortnightReviews = totalFortnightReviews - completedFortnightReviews;

    const fortnightMetrics = {
      total: totalFortnightReviews,
      completed: completedFortnightReviews,
      pending: pendingFortnightReviews,
      completionRate: totalFortnightReviews > 0 ? (completedFortnightReviews / totalFortnightReviews) * 100 : 0,
    };

    // 5. Interview Trends
    const { data: trendsData, error: trendsErr } = await supabase
      .from('interviews')
      .select('created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (trendsErr) throw trendsErr;

    const trendsMap: Record<string, number> = {};
    (trendsData || []).forEach((i: any) => {
      if (!i.created_at) return;
      const month = new Date(i.created_at).toLocaleString('default', { month: 'short', year: '2-digit' });
      trendsMap[month] = (trendsMap[month] || 0) + 1;
    });

    const interviewTrends = Object.entries(trendsMap).map(([month, count]) => ({
      month,
      count,
    })).slice(-6);

    return {
      levels,
      growthTracking,
      teacherPerformance,
      fortnightMetrics,
      interviewTrends,
    };
  },
};
