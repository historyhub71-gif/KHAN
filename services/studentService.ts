import { Attendance, AttendanceStats, Course, StudentGlobalAttendance } from "../types";
import { analyticsService } from "./analyticsService";
import { supabase } from "../utils/supabase";

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
    const { data, error } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentId)
      .eq('course_id', courseId);

    if (error) throw error;

    if (!data || data.length === 0) return 0;

    const presentCount = data.filter(
      (a: any) => a.status === 'present'
    ).length;
    return Math.round((presentCount / data.length) * 100);
  },

  getAttendanceStats: async (studentId: string, courseId: string): Promise<AttendanceStats> => {
    const { data, error } = await supabase
      .from('attendance')
      .select('status, date')
      .eq('student_id', studentId)
      .eq('course_id', courseId);

    if (error) throw error;

    const total = data?.length || 0;
    const present = data?.filter((a: any) => a.status === 'present').length || 0;
    const absent = total - present;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      total,
      present,
      absent,
      percentage,
    };
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
};
