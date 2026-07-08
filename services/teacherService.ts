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

  getAssignedStudents: async (teacherId: string): Promise<any[]> => {
    // 1. Fetch course IDs taught by this teacher from course_teachers
    const { data: courseTeachers, error: ctError } = await supabase
      .from('course_teachers')
      .select('course_id')
      .eq('teacher_id', teacherId);

    if (ctError) {
      console.error('Error fetching course_teachers:', ctError);
      throw ctError;
    }
    const courseIds = courseTeachers?.map((ct: any) => ct.course_id) || [];

    // 2. Fetch student IDs enrolled in those courses from course_students
    let courseStudentIds: string[] = [];
    if (courseIds.length > 0) {
      const { data: courseStudents, error: csError } = await supabase
        .from('course_students')
        .select('student_id')
        .in('course_id', courseIds);

      if (csError) {
        console.error('Error fetching course_students:', csError);
        throw csError;
      }
      courseStudentIds = courseStudents?.map((cs: any) => cs.student_id) || [];
    }

    // 3. Fetch student IDs directly assigned to this teacher in student_profiles
    const { data: directProfiles, error: dpError } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('assigned_teacher_id', teacherId);

    if (dpError) {
      console.error('Error fetching student_profiles for teacher:', dpError);
      throw dpError;
    }
    const directStudentIds = directProfiles?.map((sp: any) => sp.id) || [];

    // 4. Fetch student IDs directly enrolled under this teacher from student_enrollments
    const { data: directEnrollments, error: deError } = await supabase
      .from('student_enrollments')
      .select('student_id')
      .eq('teacher_id', teacherId)
      .eq('status', 'active');

    if (deError) {
      console.error('Error fetching student_enrollments for teacher:', deError);
      throw deError;
    }
    const enrollmentStudentIds = directEnrollments?.map((de: any) => de.student_id) || [];

    // 5. Merge and deduplicate all student IDs
    const studentIds = Array.from(new Set([
      ...courseStudentIds,
      ...directStudentIds,
      ...enrollmentStudentIds
    ]));

    if (studentIds.length === 0) {
      return [];
    }

    // 6. Fetch profiles for these student IDs
    const { data: profiles, error: pError } = await supabase
      .from('profiles')
      .select('id, name, email, created_at, status')
      .in('id', studentIds);

    if (pError) {
      console.error('Error fetching student profiles:', pError);
      throw pError;
    }

    // 7. Fetch student_profiles details for these student IDs
    const { data: studentProfiles, error: spError } = await supabase
      .from('student_profiles')
      .select('id, level, class, section')
      .in('id', studentIds);

    if (spError) {
      console.error('Error fetching student_profiles details:', spError);
      throw spError;
    }

    // 8. Fetch active enrollments with course details
    const { data: enrollments, error: eError } = await supabase
      .from('student_enrollments')
      .select('student_id, course_id, status, course:course_id(name)')
      .in('student_id', studentIds)
      .eq('status', 'active');

    if (eError) {
      console.error('Error fetching enrollments:', eError);
      throw eError;
    }

    // 9. Combine data in memory
    const spMap = new Map<string, any>();
    studentProfiles?.forEach((sp: any) => {
      spMap.set(sp.id, sp);
    });

    const enrollMap = new Map<string, any>();
    enrollments?.forEach((e: any) => {
      enrollMap.set(e.student_id, e);
    });

    return (profiles || []).map((p: any) => {
      const sp = spMap.get(p.id);
      const en = enrollMap.get(p.id);
      return {
        id: p.id,
        name: p.name || 'Unknown Student',
        email: p.email || '',
        created_at: p.created_at,
        status: p.status,
        level: sp?.level || 'Assigned',
        class: sp?.class || en?.course?.name || 'N/A',
        section: sp?.section || '',
        teacher_name: 'You',
        assigned_teacher_id: teacherId,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
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
    // Use student_progress_reports table — teachers have INSERT/SELECT RLS permission here.
    // The interviews table only allows ASR/interviewers to insert (RLS policy).
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
      student_id: params.studentId,
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
