import { Attendance, Course, Profile } from "../types";
import { supabase } from "../utils/supabase";
import { notificationService } from "./notificationService";

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
    status: 'present' | 'absent' | null,
    date: string,
    teacherId: string
  ) => {
    if (status === null) {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('course_id', courseId)
        .eq('student_id', studentId)
        .eq('date', date);

      if (error) throw error;
      return null;
    }

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

    if (status === 'absent' && data?.id) {
      const course = await teacherService.getCourse(courseId);
      const notif = await notificationService.notifyStudentAbsent({
        studentId,
        teacherId,
        courseId,
        attendanceId: data.id,
        courseName: course.name,
      });
      if (!notif.ok) {
        console.warn('Notification not created:', notif.error);
      }
    }

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

  getCourseAttendanceHistory: async (courseId: string): Promise<Attendance[]> => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, student:profiles!attendance_student_id_fkey(*)')
      .eq('course_id', courseId)
      .order('date', { ascending: false });

    if (error) throw error;
    return (data || []) as Attendance[];
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

  isTeacherAssignedToCourse: async (
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

  deleteAttendanceByDate: async (courseId: string, date: string): Promise<void> => {
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('course_id', courseId)
      .eq('date', date);

    if (error) throw error;
  },

  deleteAllAttendance: async (courseId: string): Promise<void> => {
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('course_id', courseId);

    if (error) throw error;
  },

  // ─── Student Progress Profile ──────────────────────────────────────────────

  // Get all students assigned to this teacher via student_profiles
  getAssignedStudents: async (teacherId: string): Promise<any[]> => {
    const { data, error } = await supabase
      .from('student_profiles')
      .select(`
        *,
        student:id(id, name, email, created_at),
        teacher:assigned_teacher_id(name)
      `)
      .eq('assigned_teacher_id', teacherId);

    if (error) throw error;

    return (data || []).map((sp: any) => ({
      id: sp.id,
      name: sp.student?.name || 'Unknown',
      email: sp.student?.email || '',
      created_at: sp.student?.created_at,
      level: sp.level,
      class: sp.class,
      section: sp.section,
      teacher_name: sp.teacher?.name,
      assigned_teacher_id: sp.assigned_teacher_id,
    }));
  },

  // Get interview history for a student (admission + fortnightly reviews)
  getStudentInterviewHistory: async (studentId: string): Promise<any[]> => {
    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Submit a teacher progress report for a student
  submitProgressReport: async (params: {
    studentId: string;
    teacherId: string;
    progressNotes: string;
    improvementPercentage: number;
  }): Promise<void> => {
    const { error } = await supabase
      .from('student_progress_reports')
      .insert({
        student_id: params.studentId,
        teacher_id: params.teacherId,
        progress_notes: params.progressNotes,
        improvement_percentage: params.improvementPercentage,
      });

    if (error) throw error;

    // Notify the student
    await supabase.from('notifications').insert({
      user_id: params.studentId,
      role: 'student',
      notification_type: 'progress_report',
      title: 'Progress Report Submitted',
      message: `Your teacher has submitted a progress report. Improvement: ${params.improvementPercentage}%.`,
      read: false,
    });
  },

  // Get progress reports for a student
  getStudentProgressReports: async (studentId: string): Promise<any[]> => {
    const { data, error } = await supabase
      .from('student_progress_reports')
      .select('*, teacher:teacher_id(name)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((r: any) => ({
      ...r,
      teacher_name: r.teacher?.name,
    }));
  },

  // Get notifications received by teacher
  getTeacherNotifications: async (teacherId: string): Promise<any[]> => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', teacherId)
      .eq('role', 'teacher')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    return data || [];
  },

  markNotificationRead: async (notificationId: string): Promise<void> => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) throw error;
  },
};
