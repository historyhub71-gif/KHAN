import { TeacherAttendance } from '../types';
import { supabase } from '../utils/supabase';

export const teacherAttendanceService = {
  // Get today's attendance record for a teacher
  getTodayRecord: async (teacherId: string): Promise<TeacherAttendance | null> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('teacher_attendance')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('date', today)
      .maybeSingle();

    if (error) throw error;
    return data as TeacherAttendance | null;
  },

  // Daily Check-in
  checkIn: async (teacherId: string): Promise<TeacherAttendance> => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const nowTimeStr = new Date().toTimeString().slice(0, 8); 

    const checkInHour = parseInt(nowTimeStr.split(':')[0], 10);
    const checkInMinute = parseInt(nowTimeStr.split(':')[1], 10);
    const isLate = checkInHour > 9 || (checkInHour === 9 && checkInMinute > 0);
    const status = isLate ? 'late' : 'present';

    const { data, error } = await supabase
      .from('teacher_attendance')
      .insert({
        teacher_id: teacherId,
        date: todayStr,
        check_in: nowTimeStr,
        status: status,
      })
      .select()
      .single();

    if (error) throw error;
    return data as TeacherAttendance;
  },

  // Daily Check-out
  checkOut: async (teacherId: string, recordId: string): Promise<TeacherAttendance> => {
    const nowTimeStr = new Date().toTimeString().slice(0, 8); 

    const { data, error } = await supabase
      .from('teacher_attendance')
      .update({
        check_out: nowTimeStr,
      })
      .eq('id', recordId)
      .eq('teacher_id', teacherId)
      .select()
      .single();

    if (error) throw error;
    return data as TeacherAttendance;
  },

  // Get teacher's attendance history
  getHistory: async (teacherId: string): Promise<TeacherAttendance[]> => {
    const { data, error } = await supabase
      .from('teacher_attendance')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Admin: Get all teacher attendance records for a specific date
  getAllTeacherAttendance: async (date?: string): Promise<TeacherAttendance[]> => {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('teacher_attendance')
      .select('*, profiles:teacher_id(name)')
      .eq('date', targetDate)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      teacher_name: row.profiles?.name,
    }));
  },
};
