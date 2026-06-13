import { SalaryDeduction, TeacherSalarySetting } from '../types';
import { supabase } from '../utils/supabase';

export const salaryService = {
  // Set/update base salary configuration for a teacher
  setSalarySetting: async (params: {
    teacherId: string;
    monthlySalary: number;
    workingDays: number;
    effectiveFrom: string;
  }): Promise<TeacherSalarySetting> => {
    const { data, error } = await supabase
      .from('teacher_salary_settings')
      .insert({
        teacher_id: params.teacherId,
        monthly_salary: params.monthlySalary,
        working_days: params.workingDays,
        effective_from: params.effectiveFrom,
      })
      .select()
      .single();

    if (error) throw error;
    return data as TeacherSalarySetting;
  },

  // Get the current active salary setting for a teacher
  getCurrentSalarySetting: async (teacherId: string): Promise<TeacherSalarySetting | null> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('teacher_salary_settings')
      .select('*')
      .eq('teacher_id', teacherId)
      .lte('effective_from', today)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as TeacherSalarySetting | null;
  },

  // Get settings history
  getSalarySettingsHistory: async (teacherId: string): Promise<TeacherSalarySetting[]> => {
    const { data, error } = await supabase
      .from('teacher_salary_settings')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('effective_from', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Calculate salary & deductions dynamically for a specific month/year
  calculateMonthlySalary: async (teacherId: string, month: number, year: number): Promise<{
    baseSalary: number;
    workingDays: number;
    actualAbsences: number;
    totalLates: number;
    effectiveAbsences: number;
    deductionAmount: number;
    finalSalary: number;
  }> => {
    const endOfMonthStr = new Date(year, month, 0).toISOString().slice(0, 10);
    const { data: setting, error: settingErr } = await supabase
      .from('teacher_salary_settings')
      .select('*')
      .eq('teacher_id', teacherId)
      .lte('effective_from', endOfMonthStr)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingErr) throw settingErr;
    
    const baseSalary = setting ? Number(setting.monthly_salary) : 0;
    const workingDays = setting ? Number(setting.working_days) : 22;

    const startOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const { data: attendance, error: attErr } = await supabase
      .from('teacher_attendance')
      .select('*')
      .eq('teacher_id', teacherId)
      .gte('date', startOfMonthStr)
      .lte('date', endOfMonthStr);

    if (attErr) throw attErr;

    const actualAbsences = (attendance || []).filter((r) => r.status === 'absent').length;
    const totalLates = (attendance || []).filter((r) => r.status === 'late').length;

    const effectiveAbsences = actualAbsences + Math.floor(totalLates / 2);

    const dailySalary = baseSalary > 0 && workingDays > 0 ? baseSalary / workingDays : 0;
    const deductionAmount = Math.round(dailySalary * effectiveAbsences * 100) / 100;
    const finalSalary = Math.max(0, baseSalary - deductionAmount);

    return {
      baseSalary,
      workingDays,
      actualAbsences,
      totalLates,
      effectiveAbsences,
      deductionAmount,
      finalSalary,
    };
  },

  // Save/Submit monthly salary deduction report
  saveDeductionReport: async (params: {
    teacherId: string;
    month: number;
    year: number;
    baseSalary: number;
    workingDays: number;
    actualAbsences: number;
    totalLates: number;
    effectiveAbsences: number;
    deductionAmount: number;
    finalSalary: number;
  }): Promise<SalaryDeduction> => {
    const { data, error } = await supabase
      .from('salary_deductions')
      .upsert({
        teacher_id: params.teacherId,
        month: params.month,
        year: params.year,
        base_salary: params.baseSalary,
        working_days: params.workingDays,
        actual_absences: params.actualAbsences,
        total_lates: params.totalLates,
        effective_absences: params.effectiveAbsences,
        deduction_amount: params.deductionAmount,
        final_salary: params.finalSalary,
      }, { onConflict: 'teacher_id,month,year' })
      .select()
      .single();

    if (error) throw error;
    return data as SalaryDeduction;
  },

  // Get finalized deduction reports
  getDeductionReports: async (month?: number, year?: number, teacherId?: string): Promise<SalaryDeduction[]> => {
    let query = supabase
      .from('salary_deductions')
      .select('*, profiles:teacher_id(name)')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (month !== undefined) query = query.eq('month', month);
    if (year !== undefined) query = query.eq('year', year);
    if (teacherId !== undefined) query = query.eq('teacher_id', teacherId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      teacher_name: row.profiles?.name,
    }));
  },
};
