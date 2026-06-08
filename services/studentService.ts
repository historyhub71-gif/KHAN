import { Attendance, AttendanceStats, Course, StudentGlobalAttendance } from "../types";
import { calculateAttendanceStats } from "../utils/attendanceCalculations";
import { supabase } from "../utils/supabase";
import { analyticsService } from "./analyticsService";

export const studentService = {
  getCourses: async (studentId: string): Promise<Course[]> => {
    const { data, error } = await supabase
      .from('course_students')
      .select(`
        courses (
          *,
          course_teachers (
            profiles (
              name
            )
          )
        )
      `)
      .eq('student_id', studentId);

    if (error) throw error;
    return data?.map((item: any) => {
      const course = item.courses;
      if (!course) return null;

      const teacherName = course.course_teachers?.[0]?.profiles?.name || 'Not Assigned';
      return {
        ...course,
        teacher_name: teacherName,
      };
    }).filter(Boolean) as Course[] || [];
  },

  getAttendance: async (
    studentId: string,
    courseId?: string
  ): Promise<Attendance[]> => {
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('student_id', studentId);

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data, error } = await query.order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  getAttendancePercentage: async (
    studentId: string,
    courseId: string
  ): Promise<number> => {
    const records = await studentService.getAttendance(studentId, courseId);
    const stats = calculateAttendanceStats(records);
    return stats.percentage;
  },

  getAttendanceStats: async (studentId: string, courseId: string): Promise<AttendanceStats> => {
    const records = await studentService.getAttendance(studentId, courseId);
    return calculateAttendanceStats(records);
  },

  getMonthlyAttendance: async (studentId: string, courseId: string, year: number, month: number) => {
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  getGlobalAttendance: async (
    studentId: string
  ): Promise<StudentGlobalAttendance> => {
    return analyticsService.getStudentGlobalAttendance(studentId);
  },

  deleteAttendance: async (ids: string[]): Promise<void> => {
    const { error } = await supabase
      .from('attendance')
      .delete()
      .in('id', ids);
    if (error) throw error;
  },
};
