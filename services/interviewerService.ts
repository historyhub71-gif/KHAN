import { Interview, Profile, StudentProgressReview } from '../types';
import { supabase } from '../utils/supabase';

export const interviewerService = {
  // Get newly registered students who don't have an admission interview yet
  getNewStudents: async (): Promise<any[]> => {
    console.log("[interviewerService] getNewStudents called");
    const result: any[] = [];
    
    try {
      // 1. Get existing admission interviews to filter them out (using both ID and Email)
      const { data: interviews, error: interviewError } = await supabase
        .from('interviews')
        .select('student_id, student_email')
        .eq('interview_type', 'admission')
        .is('deleted_at', null)
        .in('status', ['admin_approved', 'completed', 'pending_admin_review']);

      if (interviewError) {
        console.warn("[interviewerService] Error fetching existing interviews:", interviewError.message);
      }
      
      const interviewedIds = new Set(interviews?.map((i) => i.student_id).filter(Boolean) || []);
      const interviewedEmails = new Set(interviews?.map((i) => i.student_email).filter(Boolean) || []);

      // 2. Get students who HAVE signed up
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          admission_deals!student_id (
            id, student_id, student_email, created_at, student_account_status, admission_status,
            course:course_id (name)
          )
        `)
        .eq('role', 'student')
        .neq('status', 'rejected');

      if (profileError) {
        console.error("[interviewerService] Error fetching profiles with deals:", profileError.message);
        // Fallback to simple profiles fetch if join fails
        const { data: profilesSimple } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .neq('status', 'rejected');
        
        (profilesSimple || []).forEach((s: any) => {
          if (!interviewedIds.has(s.id) && !interviewedEmails.has(s.email)) {
            result.push({
              ...s,
              course_name: 'N/A',
              interview_status: s.status === 'waiting_approval' ? 'Waiting Interview' : 'Pending',
              is_placeholder: false,
            });
          }
        });
      } else {
        (profiles || []).forEach((s: any) => {
          if (!interviewedIds.has(s.id) && !interviewedEmails.has(s.email)) {
            const deal = s.admission_deals?.[0] || null;
            // Prioritize admission_status as it contains 'pending_admin_review' and other workflow steps
            const statusVal = deal?.admission_status || deal?.student_account_status || 'Pending';
            result.push({
              ...s,
              course_name: deal?.course?.name || 'N/A',
              interview_status: s.status === 'waiting_approval' ? 'Waiting Interview' : statusVal,
              created_at: deal?.created_at || s.created_at,
              is_placeholder: false,
            });
          }
        });
      }

      // 3. Get admission deals where student HAS NOT signed up yet (orphan deals)
      const { data: deals, error: dealError } = await supabase
        .from('admission_deals')
        .select('*, course:course_id(name)')
        .is('student_id', null);

      if (!dealError && deals) {
        deals.forEach((d: any) => {
          if (!interviewedEmails.has(d.student_email)) {
            result.push({
              id: d.id, // Temporary ID (Deal ID)
              name: d.student_name,
              email: d.student_email,
              course_name: d.course?.name || 'N/A',
              interview_status: 'Pre-Signup Deal',
              created_at: d.created_at,
              is_placeholder: true,
              // Keep original deal data for placeholder resolution
              father_name: d.father_name,
              phone_number: d.phone_number,
              whatsapp_number: d.whatsapp_number,
              course_id: d.course_id,
              teacher_id: d.teacher_id,
              class: d.class,
            });
          }
        });
      }

      const sortedResult = result.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
      
      console.log("[interviewerService] getNewStudents final count:", sortedResult.length);
      return sortedResult;
    } catch (err) {
      console.error("[interviewerService] Critical error in getNewStudents:", err);
      return result; // Return whatever we gathered
    }
  },

  // Submit a new interview (admission or progress review)
  submitInterview: async (interview: Omit<Interview, 'id' | 'created_at' | 'updated_at' | 'total_score'>): Promise<Interview> => {
    const totalScore = (interview.english || 0) +
      (interview.communication || 0) +
      (interview.confidence || 0) +
      (interview.technical_skills || 0) +
      (interview.learning_ability || 0);

    const { data, error } = await supabase
      .from('interviews')
      .insert({
        ...interview,
        total_score: totalScore,
      })
      .select()
      .single();

    if (error) throw error;

    if (interview.interview_type === 'admission' && data.assigned_level) {
      const { error: spError } = await supabase
        .from('student_profiles')
        .upsert({
          id: interview.student_id,
          level: data.assigned_level,
        });
      if (spError) console.warn('Failed to upsert student profile level:', spError.message);

      await supabase.from('notifications').insert({
        user_id: interview.student_id,
        student_id: interview.student_id,
        role: 'student',
        notification_type: 'interview_completed',
        title: 'Interview Assessment Completed',
        message: `Your admission interview is complete. Level assigned: ${data.assigned_level}.`,
        read: false,
      });
    }

    return data as Interview;
  },

  // Retrieve assessment history for a specific student
  getStudentInterviews: async (studentId: string): Promise<Interview[]> => {
    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Soft delete interview
  deleteInterview: async (id: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from('interviews')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', id);

    if (error) throw error;
  },

  // Get scheduled progress reviews
  getPendingProgressReviews: async (): Promise<StudentProgressReview[]> => {
    console.log("[interviewerService] getPendingProgressReviews called");
    try {
      // Try fortnight_reviews first
      const { data, error } = await supabase
        .from('fortnight_reviews')
        .select('*, profiles!student_id(name)')
        .is('completed_at', null)
        .order('scheduled_date', { ascending: true });

      if (error) {
        console.warn("[interviewerService] fortnight_reviews query failed, trying student_progress_reviews:", error.message);
        // Try student_progress_reviews as fallback
        const { data: data2, error: error2 } = await supabase
          .from('student_progress_reviews')
          .select('*, profiles!student_id(name)')
          .is('completed_at', null)
          .order('scheduled_date', { ascending: true });

        if (error2) {
          console.error("[interviewerService] Both fortnight_reviews and student_progress_reviews failed:", error2.message);
          return []; // Return empty array instead of throwing to prevent dashboard crash
        }
        
        const mappedData = (data2 || []).map((row: any) => ({
          ...row,
          student_name: row.profiles?.name || 'Unknown Student',
          review_interview_id: row.admission_interview_id || row.interview_id,
        }));
        console.log("[interviewerService] getPendingProgressReviews (fallback) success:", mappedData.length);
        return mappedData;
      }

      const mappedData = (data || []).map((row: any) => ({
        ...row,
        student_name: row.profiles?.name || 'Unknown Student',
        review_interview_id: row.interview_id,
      }));
      console.log("[interviewerService] getPendingProgressReviews success:", mappedData.length);
      return mappedData;
    } catch (err) {
      console.error("[interviewerService] Unexpected error in getPendingProgressReviews:", err);
      return [];
    }
  },

  // Complete a progress review
  completeProgressReview: async (params: {
    reviewId: string;
    notes: string;
    english: number;
    communication: number;
    confidence: number;
    technicalSkills: number;
    learningAbility: number;
    assignedLevel: 'Beginner' | 'Intermediate' | 'Advanced';
    strengths: string;
    weaknesses: string;
    recommendations: string;
    interviewerId: string;
  }): Promise<void> => {
    // 1. Get the current review record
    const { data: review, error: reviewErr } = await supabase
      .from('fortnight_reviews')
      .select('*')
      .eq('id', params.reviewId)
      .single();

    if (reviewErr) throw reviewErr;

    // 2. Find the student's most recent completed interview to calculate growth
    const { data: prevInterview, error: prevErr } = await supabase
      .from('interviews')
      .select('total_score')
      .eq('student_id', review.student_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const oldTotal = prevInterview?.total_score || 0;
    const newTotal = params.english + params.communication + params.confidence + params.technicalSkills + params.learningAbility;
    const growth = oldTotal > 0
      ? Math.round(((newTotal - oldTotal) / oldTotal) * 100)
      : 0;

    // 3. Create a new interview record for this progress review
    const { data: newInterview, error: newIntErr } = await supabase
      .from('interviews')
      .insert({
        student_id: review.student_id,
        interviewer_id: params.interviewerId,
        interview_type: 'progress_review',
        notes: params.notes,
        english: params.english,
        communication: params.communication,
        confidence: params.confidence,
        technical_skills: params.technicalSkills,
        learning_ability: params.learningAbility,
        total_score: newTotal,
        assigned_level: params.assignedLevel,
        strengths: params.strengths,
        weaknesses: params.weaknesses,
        recommendations: params.recommendations,
      })
      .select()
      .single();

    if (newIntErr) throw newIntErr;

    // 4. Update the fortnight review record
    const { error: updateReviewErr } = await supabase
      .from('fortnight_reviews')
      .update({
        interview_id: newInterview.id,
        completed_at: new Date().toISOString(),
        notes: params.recommendations,
      })
      .eq('id', params.reviewId);

    if (updateReviewErr) throw updateReviewErr;

    // 5. Update student level
    await supabase
      .from('student_profiles')
      .update({ level: params.assignedLevel })
      .eq('id', review.student_id);

    // 6. Notify student
    await supabase.from('notifications').insert({
      user_id: review.student_id,
      student_id: review.student_id,
      role: 'student',
      notification_type: 'progress_review_due',
      title: 'Progress Review Complete',
      message: `Your progress review (Level: ${params.assignedLevel}) is complete. Growth: ${growth}%.`,
      read: false,
    });

    // 7. Notify teacher (also reference student_id for cascade-delete on student removal)
    const { data: sp } = await supabase
      .from('student_profiles')
      .select('assigned_teacher_id')
      .eq('id', review.student_id)
      .single();

    if (sp?.assigned_teacher_id) {
      await supabase.from('notifications').insert({
        user_id: sp.assigned_teacher_id,
        student_id: review.student_id,
        role: 'teacher',
        notification_type: 'progress_review_due',
        title: 'Student Progress Review Complete',
        message: `Progress review for your student was completed. Growth: ${growth}%.`,
        read: false,
      });
    }
  },
};
