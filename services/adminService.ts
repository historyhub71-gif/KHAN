import { Course, Profile, StudentProfile } from "../types";
import { supabase } from "../utils/supabase";

export const adminService = {
  // Teacher Management
  getTeachers: async (): Promise<Profile[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'teacher')
      .neq('status', 'rejected')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  getTeacher: async (id: string): Promise<Profile> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  deleteTeacher: async (id: string) => {
    const { error } = await supabase.rpc('delete_user_by_id', { p_user_id: id });
    if (error) throw error;
  },

  approveTeacher: async (id: string, officialCheckInTime: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        approved: true,
        status: 'approved',
        official_check_in_time: officialCheckInTime,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateTeacherCheckInTime: async (id: string, officialCheckInTime: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        official_check_in_time: officialCheckInTime,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  rejectTeacher: async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ approved: false, status: 'rejected' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Student Management
  getStudents: async (): Promise<Profile[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .neq('status', 'rejected')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  getStudent: async (id: string): Promise<Profile> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  deleteStudent: async (id: string) => {
    // The delete_user_by_id RPC performs a complete cascading cleanup:
    // notifications, attendance, fortnight_reviews, student_progress_reports,
    // interviews, course_students, student_enrollments, fee_ledger, fee_payments
    // (→ fee_receipts), student_profiles, and finally profiles + auth.users.
    // It also nullifies student_id on admission_deals to preserve financial records.
    const { error } = await supabase.rpc('delete_user_by_id', { p_user_id: id });
    if (error) throw error;
  },

  approveStudent: async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ approved: true, status: 'approved' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  rejectStudent: async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ approved: false, status: 'rejected' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get student profile (class, section, assigned teacher, level)
  getStudentProfile: async (studentId: string): Promise<StudentProfile | null> => {
    const { data, error } = await supabase
      .from('student_profiles')
      .select('*, teacher:profiles!fk_assigned_teacher(name)')
      .eq('id', studentId)
      .maybeSingle();

    if (error) {
      console.error("Error in getStudentProfile:", error);
      throw error;
    }
    if (!data) return null;

    return {
      ...data,
      teacher_name: (data as any).teacher?.name,
    } as StudentProfile;
  },

  // Fetch all students with their profiles (for admission management)
  getStudentsWithProfiles: async (): Promise<(Profile & { studentProfile?: StudentProfile, pendingInterviewId?: string })[]> => {
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .neq('status', 'rejected')
      .order('created_at', { ascending: false });

    if (profError) {
      console.error("Error fetching profiles in getStudentsWithProfiles:", profError);
      throw profError;
    }
    if (!profiles || profiles.length === 0) return [];

    const studentIds = profiles.map((p) => p.id);

    // 1. Get student profiles
    const { data: studentProfiles, error: spError } = await supabase
      .from('student_profiles')
      .select('*, teacher:profiles!fk_assigned_teacher(name)')
      .in('id', studentIds);
    
    if (spError) console.error("Error fetching student profiles in getStudentsWithProfiles:", spError);

    // 2. Get pending interviews
    const { data: pendingInterviews, error: intError } = await supabase
      .from('interviews')
      .select('id, student_id')
      .eq('status', 'pending_admin_review')
      .is('deleted_at', null)
      .in('student_id', studentIds);
    
    if (intError) console.error("Error fetching interviews in getStudentsWithProfiles:", intError);

    const spMap: Record<string, StudentProfile> = {};
    (studentProfiles || []).forEach((sp: any) => {
      spMap[sp.id] = { ...sp, teacher_name: sp.teacher?.name };
    });

    const intMap: Record<string, string> = {};
    (pendingInterviews || []).forEach((i: any) => {
      intMap[i.student_id] = i.id;
    });

    const result = profiles.map((p) => ({
      ...p,
      studentProfile: spMap[p.id],
      pendingInterviewId: intMap[p.id],
    }));

    console.log("Admin getStudentsWithProfiles data:", result);
    return result;
  },

  // Interviewer Management
  getInterviewers: async (): Promise<Profile[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'interviewer')
      .neq('status', 'rejected')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  approveInterviewer: async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ approved: true, status: 'approved' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  rejectInterviewer: async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ approved: false, status: 'rejected' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteInterviewer: async (id: string) => {
    const { error } = await supabase.rpc('delete_user_by_id', { p_user_id: id });
    if (error) throw error;
  },

  // Course Management
  getCourses: async (): Promise<Course[]> => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  getCourse: async (id: string): Promise<Course> => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  createCourse: async (name: string, code: string, createdBy: string) => {
    const { data, error } = await supabase
      .from('courses')
      .insert({ name, code, created_by: createdBy })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateCourse: async (id: string, updates: Partial<Course>) => {
    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteCourse: async (id: string) => {
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw error;
  },

  // Course-Teacher Assignment
  assignTeacherToCourse: async (courseId: string, teacherId: string) => {
    const { data: existing, error: fetchError } = await supabase
      .from('course_teachers')
      .select('id')
      .eq('course_id', courseId)
      .eq('teacher_id', teacherId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (existing) return existing;

    const { data, error } = await supabase
      .from('course_teachers')
      .insert({ course_id: courseId, teacher_id: teacherId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  assignMultipleTeachersToCourse: async (courseId: string, teacherIds: string[]) => {
    const { data: existing, error: fetchError } = await supabase
      .from('course_teachers')
      .select('teacher_id')
      .eq('course_id', courseId);

    if (fetchError) throw fetchError;

    const existingTeacherIds = new Set(existing?.map((item: any) => item.teacher_id) || []);
    const newTeacherIds = teacherIds.filter(id => !existingTeacherIds.has(id));

    if (newTeacherIds.length === 0) {
      return [];
    }

    const inserts = newTeacherIds.map(id => ({ course_id: courseId, teacher_id: id }));
    const { data, error } = await supabase
      .from('course_teachers')
      .insert(inserts)
      .select();

    if (error) throw error;
    return data;
  },

  removeTeacherFromCourse: async (courseId: string, teacherId: string) => {
    const { error } = await supabase
      .from('course_teachers')
      .delete()
      .eq('course_id', courseId)
      .eq('teacher_id', teacherId);

    if (error) throw error;
  },

  getCourseTeachers: async (courseId: string) => {
    const { data, error } = await supabase
      .from('course_teachers')
      .select('teacher_id, profiles(*)')
      .eq('course_id', courseId);

    if (error) throw error;
    return data?.map((item: any) => item.profiles).filter(Boolean) || [];
  },

  // Course-Student Assignment
  assignStudentToCourse: async (courseId: string, studentId: string) => {
    const { data: existing, error: fetchError } = await supabase
      .from('course_students')
      .select('id')
      .eq('course_id', courseId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (existing) return existing;

    const { data, error } = await supabase
      .from('course_students')
      .insert({ course_id: courseId, student_id: studentId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  assignMultipleStudentsToCourse: async (courseId: string, studentIds: string[]) => {
    const { data: existing, error: fetchError } = await supabase
      .from('course_students')
      .select('student_id')
      .eq('course_id', courseId);

    if (fetchError) throw fetchError;

    const existingStudentIds = new Set(existing?.map((item: any) => item.student_id) || []);
    const newStudentIds = studentIds.filter(id => !existingStudentIds.has(id));

    if (newStudentIds.length === 0) {
      return [];
    }

    const inserts = newStudentIds.map(id => ({ course_id: courseId, student_id: id }));
    const { data, error } = await supabase
      .from('course_students')
      .insert(inserts)
      .select();

    if (error) throw error;
    return data;
  },

  removeStudentFromCourse: async (courseId: string, studentId: string) => {
    const { error } = await supabase
      .from('course_students')
      .delete()
      .eq('course_id', courseId)
      .eq('student_id', studentId);

    if (error) throw error;
  },

  getCourseStudents: async (courseId: string) => {
    const { data, error } = await supabase
      .from('course_students')
      .select('student_id, profiles(*)')
      .eq('course_id', courseId);

    if (error) throw error;
    return data?.map((item: any) => item.profiles).filter(Boolean) || [];
  },
};
