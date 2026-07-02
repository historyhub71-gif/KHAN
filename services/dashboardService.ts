import { supabase } from "../utils/supabase";

export const dashboardService = {
  getAdminStats: async () => {
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
    if (error) throw error;
    return data;
  },

  getTeacherStats: async (teacherId: string) => {
    const { data, error } = await supabase.rpc('get_teacher_dashboard_stats', {
      p_teacher_id: teacherId
    });
    if (error) throw error;
    return data;
  }
};
