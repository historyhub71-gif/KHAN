import { Notification } from '../types';
import { supabase } from '../utils/supabase';

const ABSENCE_TITLE = 'Attendance Alert';

export const notificationService = {
  getForStudent: async (studentId: string): Promise<Notification[]> => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as Notification[]) || [];
  },

  /** Called when teacher marks absent — works with DB trigger or alone if trigger missing */
  notifyStudentAbsent: async (params: {
    studentId: string;
    teacherId: string;
    courseId: string;
    attendanceId: string;
    courseName: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    const message = `You were marked absent today in ${params.courseName}.`;

    const { error: rpcError } = await supabase.rpc('create_absence_notification', {
      p_student_id: params.studentId,
      p_teacher_id: params.teacherId,
      p_course_id: params.courseId,
      p_attendance_id: params.attendanceId,
      p_message: message,
    });

    if (!rpcError) return { ok: true };

    const { error: insertError } = await supabase.from('notifications').insert({
      student_id: params.studentId,
      teacher_id: params.teacherId,
      course_id: params.courseId,
      attendance_id: params.attendanceId,
      title: ABSENCE_TITLE,
      message,
      read: false,
    });

    if (!insertError) return { ok: true };

    const detail = insertError.message || rpcError.message;
    console.warn('Failed to create absence notification:', detail);
    return { ok: false, error: detail };
  },

  getUnreadCount: async (studentId: string): Promise<number> => {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('read', false);

    if (error) throw error;
    return count ?? 0;
  },

  markRead: async (notificationId: string, studentId: string): Promise<void> => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('student_id', studentId);

    if (error) throw error;
  },

  markAllRead: async (studentId: string): Promise<void> => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('student_id', studentId)
      .eq('read', false);

    if (error) throw error;
  },

  deleteNotifications: async (ids: string[], studentId: string): Promise<void> => {
    if (!ids.length) return;
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('student_id', studentId)
      .in('id', ids);

    if (error) throw error;
  },
};
