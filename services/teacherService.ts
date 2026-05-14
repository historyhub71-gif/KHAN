import { Course, Profile } from "../types";
import { supabase } from "../utils/supabase";

export const teacherService = {
  // Get assigned courses
  getCourses: async (teacherId: string): Promise<Course[]> => {
    const { data, error } = await supabase
      .from('course_teachers')
      .select('courses(*)')
      .eq('teacher_id', teacherId);

    if (error) throw error;
    return data?.map((item: any) => item.courses).filter(Boolean) || [];
  },

  getCourse: async (courseId: string): Promise<Course> => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (error) throw error;
    return data;
  },

  // Get course students
  getCourseStudents: async (courseId: string): Promise<Profile[]> => {
    const { data, error } = await supabase
      .from('course_students')
      .select('profiles(*)')
      .eq('course_id', courseId);

    if (error) throw error;
    return data?.map((item: any) => item.profiles).filter(Boolean) || [];
  },

  // Attendance operations
  markAttendance: async (
    courseId: string,
    studentId: string,
    status: 'present' | 'absent',
    date: string,
    teacherId: string
  ) => {
    const { data, error } = await supabase
      .from('attendance')
      .upsert(
        {
          course_id: courseId,
          student_id: studentId,
          teacher_id: teacherId,
          status,
          date,
        },
        {
          onConflict: 'course_id,student_id,date',
        }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getAttendanceByDate: async (courseId: string, date: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('course_id', courseId)
      .eq('date', date);

    if (error) throw error;
    return data || [];
  },

  getCourseAttendanceHistory: async (courseId: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('course_id', courseId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  getStudentAttendanceInCourse: async (courseId: string, studentId: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('course_id', courseId)
      .eq('student_id', studentId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
