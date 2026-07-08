import { supabase } from '../utils/supabase';

// ─────────────────────────────────────────────
// Admission Deal Service
// ─────────────────────────────────────────────
export const admissionService = {

  // ── Get all admission deals (admin / director view)
  getAllDeals: async () => {
    const { data, error } = await supabase
      .from('admission_deals')
      .select(`
        *,
        course:course_id(id, name, code),
        teacher:teacher_id(id, name),
        student:student_id(id, name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((d: any) => ({
      ...d,
      course_name: d.course?.name,
      teacher_name: d.teacher?.name,
      student_account_name: d.student?.name,
    }));
  },

  // ── Create a new admission deal (ASR or Admin)
  createDeal: async (params: {
    studentName: string;
    studentEmail: string;
    fatherName?: string;
    phoneNumber?: string;
    whatsappNumber?: string;
    courseId: string;
    teacherId?: string;
    class?: string;
    originalFee: number;
    discountAmount?: number;
    discountPercentage?: number;
    finalFee: number;
    remarks?: string;
  }) => {
    const discount = params.discountAmount ?? 0;
    const pct = params.discountPercentage ?? (params.originalFee > 0 ? (discount / params.originalFee) * 100 : 0);

    // 1. Create the deal record
    const { data: deal, error: dealError } = await supabase
      .from('admission_deals')
      .insert({
        student_name: params.studentName,
        student_email: params.studentEmail,
        father_name: params.fatherName || null,
        phone_number: params.phoneNumber || null,
        whatsapp_number: params.whatsappNumber || null,
        course_id: params.courseId || null,
        teacher_id: params.teacherId || null,
        class: params.class || null,
        original_fee: params.originalFee,
        discount_amount: discount,
        discount_percentage: pct,
        final_fee: params.finalFee,
        remarks: params.remarks || '',
        payment_status: 'pending',
        admission_status: 'pending',
      })
      .select()
      .single();

    if (dealError) throw dealError;

    return deal;
  },

  // ── Update an existing deal
  updateDeal: async (dealId: string, updates: Record<string, any>) => {
    const { data, error } = await supabase
      .from('admission_deals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', dealId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ── Delete a deal
  deleteDeal: async (dealId: string) => {
    const { error } = await supabase
      .from('admission_deals')
      .delete()
      .eq('id', dealId);

    if (error) throw error;
  },

  // ── Mark payment as paid
  markPaid: async (dealId: string) => {
    const { data, error } = await supabase
      .from('admission_deals')
      .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', dealId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ── ASR submits interview for admin review
  submitInterviewForReview: async (params: {
    studentId: string;
    interviewerId: string;
    english: number;
    communication: number;
    confidence: number;
    technicalSkills: number;
    learningAbility: number;
    assignedLevel: string;
    strengths: string;
    weaknesses: string;
    recommendations: string;
    notes: string;
    recommendedCourseId?: string | null;
    recommendedTeacherId?: string | null;
  }) => {
    const { data, error } = await supabase.rpc('submit_interview_for_review', {
      p_student_id:          params.studentId,
      p_interviewer_id:      params.interviewerId,
      p_english:             params.english,
      p_communication:       params.communication,
      p_confidence:          params.confidence,
      p_technical_skills:    params.technicalSkills,
      p_learning_ability:    params.learningAbility,
      p_assigned_level:      params.assignedLevel,
      p_strengths:           params.strengths,
      p_weaknesses:          params.weaknesses,
      p_recommendations:     params.recommendations,
      p_notes:               params.notes,
      p_recommended_course:  params.recommendedCourseId ?? null,
      p_recommended_teacher: params.recommendedTeacherId ?? null,
    });

    if (error) throw error;
    return data as string; // interview id
  },

  // ── Admin: Get interviews pending review
  getPendingAdminReviews: async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select(`
        *,
        student:student_id(
          id, 
          name, 
          email,
          admission_deals:admission_deals!student_id (
            id, course_id, teacher_id, class, section
          )
        ),
        interviewer:interviewer_id(id, name),
        recommended_course:recommended_course_id(id, name, code),
        recommended_teacher:recommended_teacher_id(id, name)
      `)
      .eq('status', 'pending_admin_review')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((i: any) => ({
      ...i,
      student_name: i.student?.name,
      student_email: i.student?.email,
      interviewer_name: i.interviewer?.name,
      recommended_course_name: i.recommended_course?.name,
      recommended_teacher_name: i.recommended_teacher?.name,
      // Add prioritized deal info for fallback in UI
      deal: i.student?.admission_deals?.[0] || null,
    }));
  },

  // ── Admin: Approve admission workflow
  approveStudentAdmissionWorkflow: async (params: {
    interviewId: string;
    adminId: string;
    notes?: string;
    teacherId?: string | null;
    class?: string | null;
    courseId?: string | null;
  }) => {
    const { error } = await supabase.rpc('approve_student_admission_workflow', {
      p_interview_id: params.interviewId,
      p_admin_id:     params.adminId,
      p_notes:        params.notes ?? '',
      p_teacher_id:   params.teacherId ?? null,
      p_class:        params.class ?? null,
      p_course_id:    params.courseId ?? null,
    });

    if (error) throw error;
  },

  // ── Admin: Reject admission workflow
  rejectStudentAdmissionWorkflow: async (params: {
    interviewId: string;
    adminId: string;
    notes?: string;
  }) => {
    const { error } = await supabase.rpc('reject_student_admission_workflow', {
      p_interview_id: params.interviewId,
      p_admin_id:     params.adminId,
      p_notes:        params.notes ?? '',
    });

    if (error) throw error;
  },

  // ── Get fortnight reviews (for ASR / admin).
  // For 'pending': only returns reviews whose scheduled_date has arrived (due today or overdue).
  getFortnightReviews: async (filter: 'all' | 'pending' | 'completed' = 'pending') => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    let query = supabase
      .from('fortnight_reviews')
      .select(`*, student:student_id(id, name, email)`)
      .order('scheduled_date', { ascending: true });

    if (filter === 'pending') {
      query = query.is('completed_at', null).lte('scheduled_date', today);
    }
    if (filter === 'completed') query = query.not('completed_at', 'is', null);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((r: any) => ({
      ...r,
      student_name: r.student?.name,
      student_email: r.student?.email,
    }));
  },


  // ── Get interview analytics stats
  getInterviewAnalytics: async () => {
    const [allRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
      supabase.from('interviews').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('interviews').select('id', { count: 'exact', head: true }).eq('status', 'pending_admin_review'),
      supabase.from('interviews').select('id', { count: 'exact', head: true }).eq('status', 'admin_approved'),
      supabase.from('interviews').select('id', { count: 'exact', head: true }).eq('status', 'admin_rejected'),
    ]);

    return {
      total: allRes.count ?? 0,
      pendingReview: pendingRes.count ?? 0,
      approved: approvedRes.count ?? 0,
      rejected: rejectedRes.count ?? 0,
    };
  },

  // ── Trigger due fortnight review notifications (admin action)
  triggerForthnightNotifications: async () => {
    const { data, error } = await supabase.rpc('notify_due_fortnight_reviews');
    if (error) throw error;
    return data as number;
  },

  // ── Get complete student profile (student dashboard)
  getStudentCompleteProfile: async (studentId: string) => {
    const { data, error } = await supabase.rpc('get_student_complete_profile', {
      p_student_id: studentId,
    });
    if (error) throw error;
    return data;
  },
};
