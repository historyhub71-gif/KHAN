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

    // Retrieve official check-in time from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('official_check_in_time')
      .eq('id', teacherId)
      .single();

    if (profileError) throw profileError;

    const officialTime = profile?.official_check_in_time || '09:00 AM';
    
    // Parse time like "09:00 AM"
    const match = officialTime.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
    let limitHour = 9;
    let limitMinute = 0;
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && h !== 12) {
        h += 12;
      } else if (ampm === 'AM' && h === 12) {
        h = 0;
      }
      limitHour = h;
      limitMinute = m;
    }

    const checkInHour = parseInt(nowTimeStr.split(':')[0], 10);
    const checkInMinute = parseInt(nowTimeStr.split(':')[1], 10);
    const isLate = checkInHour > limitHour || (checkInHour === limitHour && checkInMinute > limitMinute);
    let status: 'present' | 'absent' | 'late' = isLate ? 'late' : 'present';

    if (status === 'late') {
      // Find the first unconverted late record for this teacher
      const { data: lateRecords, error: lateErr } = await supabase
        .from('teacher_attendance')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('status', 'late')
        .order('date', { ascending: true });

      if (lateErr) throw lateErr;

      if (lateRecords && lateRecords.length > 0) {
        // This is the second late record. Automatically convert:
        // 1. Convert the first late to present (resets late counter)
        const firstLate = lateRecords[0];
        const { error: updateErr } = await supabase
          .from('teacher_attendance')
          .update({ status: 'present' })
          .eq('id', firstLate.id);

        if (updateErr) throw updateErr;

        // 2. Set this record status to absent (creates 1 absent record)
        status = 'absent';
      }
    }

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
