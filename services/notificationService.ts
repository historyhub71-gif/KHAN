import { Notification } from '../types';
import { supabase } from '../utils/supabase';

const ABSENCE_TITLE = 'Attendance Alert';

export const notificationService = {
  // Get notifications for any user (Student, Teacher, Admin)
  getForUser: async (userId: string): Promise<Notification[]> => {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        courses:course_id(id, name, code),
        profiles:teacher_id(id, name),
        attendance:attendance_id(id, status, date)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data as Notification[]) || [];
  },

  /** Called when teacher marks absent — rely on DB trigger, but can be used for manual triggers if needed */
  notifyStudentAbsent: async (params: {
    studentId: string;
    teacherId: string;
    courseId: string;
    attendanceId: string;
    courseName: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    // Note: Migration 003 added a DB trigger 'trg_notify_student_absence' on public.attendance
    // which automatically creates a notification when status='absent'.
    // This method is now primarily for logging or explicit manual overrides.
    
    console.log(`[notificationService] Absence recorded for ${params.studentId}. DB trigger should handle notification.`);
    return { ok: true };
  },

  getUnreadCount: async (userId: string): Promise<number> => {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    return count ?? 0;
  },

  markRead: async (notificationId: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  markAllRead: async (userId: string): Promise<void> => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
  },

  deleteNotifications: async (ids: string[], userId: string): Promise<void> => {
    if (!ids.length) return;
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .in('id', ids);

    if (error) throw error;
  },
};
