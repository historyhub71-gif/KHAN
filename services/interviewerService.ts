import { Interview, Profile, StudentProgressReview } from '../types';
import { supabase } from '../utils/supabase';

export const interviewerService = {
  // Get newly registered students who don't have an admission interview yet
  getNewStudents: async (): Promise<any[]> => {
    console.log("[interviewerService] getNewStudents called");
    const result: any[] = [];
    
    try {
      // 1. Get ALL admission interviews (even if status is pending_admin_review or completed)
      const { data: interviews, error: interviewError } = await supabase
        .from('interviews')
        .select('student_id, student_email, status')
        .eq('interview_type', 'admission')
        .is('deleted_at', null);

      if (interviewError) {
        console.warn("[interviewerService] Error fetching existing interviews:", interviewError.message);
      }
      
      // Build case-insensitive sets of already interviewed IDs and emails
      const interviewedIds = new Set<string>();
      const interviewedEmails = new Set<string>();

      (interviews || []).forEach(i => {
        if (i.student_id) interviewedIds.add(i.student_id);
        if (i.student_email) interviewedEmails.add(i.student_email.toLowerCase().trim());
      });

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

      if (!profileError && profiles) {
        profiles.forEach((s: any) => {
          const emailKey = s.email?.toLowerCase().trim();
          if (interviewedIds.has(s.id) || (emailKey && interviewedEmails.has(emailKey))) {
            return; // Skip: already interviewed
          }

          const deal = s.admission_deals?.[0] || null;
          if (deal && ['pending_admin_review', 'approved', 'rejected'].includes(deal.admission_status)) {
            return; // Skip: deal is already assessed or approved/rejected
          }

          const statusVal = deal?.admission_status || deal?.student_account_status || 'Pending';
          result.push({
            ...s,
            course_name: deal?.course?.name || 'N/A',
            interview_status: s.status === 'waiting_approval' ? 'Waiting Interview' : statusVal,
            created_at: deal?.created_at || s.created_at,
            is_placeholder: false,
          });
        });
      } else if (profileError) {
        console.error("[interviewerService] Error fetching profiles with deals:", profileError.message);
        // Fallback to simple profiles fetch if join fails
        const { data: profilesSimple } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .neq('status', 'rejected');
        
        (profilesSimple || []).forEach((s: any) => {
          const emailKey = s.email?.toLowerCase().trim();
          if (!interviewedIds.has(s.id) && (!emailKey || !interviewedEmails.has(emailKey))) {
            result.push({
              ...s,
              course_name: 'N/A',
              interview_status: s.status === 'waiting_approval' ? 'Waiting Interview' : 'Pending',
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
          const emailKey = d.student_email?.toLowerCase().trim();
          if (emailKey && interviewedEmails.has(emailKey)) {
            return; // Skip: already interviewed
          }
          if (['pending_admin_review', 'approved', 'rejected'].includes(d.admission_status)) {
            return; // Skip: deal already resolved
          }

          result.push({
            id: d.id, // Temporary ID (Deal ID)
            name: d.student_name,
            email: d.student_email,
            course_name: d.course?.name || 'N/A',
            interview_status: 'Pre-Signup Deal',
            created_at: d.created_at,
            is_placeholder: true,
            father_name: d.father_name,
            phone_number: d.phone_number,
            whatsapp_number: d.whatsapp_number,
            course_id: d.course_id,
            teacher_id: d.teacher_id,
            class: d.class,
          });
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
      return result;
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

  // Get scheduled progress reviews that are due today or overdue
  getPendingProgressReviews: async (): Promise<StudentProgressReview[]> => {
    console.log("[interviewerService] getPendingProgressReviews called");
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const { data, error } = await supabase
        .from('fortnight_reviews')
        .select('*, profiles!student_id(name)')
        .is('completed_at', null)
        .lte('scheduled_date', today) // Only show reviews that are due today or overdue
        .order('scheduled_date', { ascending: true });

      if (error) {
        console.error("[interviewerService] getPendingProgressReviews query failed:", error.message);
        return [];
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
    assignedLevel: 'Beginner' | 'Elementary' | 'Intermediate' | 'Advanced';
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
        status: 'completed', // Set status explicitly to avoid showing up in Admin pending reviews queue
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

    // Automatically schedule next review (if less than 3)
    if (review.review_number < 3) {
      const nextReviewNum = review.review_number + 1;

      // Fetch the admission approval date from the initial admission interview
      const { data: adminInt } = await supabase
        .from('interviews')
        .select('admin_reviewed_at, created_at')
        .eq('student_id', review.student_id)
        .eq('interview_type', 'admission')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const approvalDateVal = adminInt?.admin_reviewed_at || adminInt?.created_at || new Date().toISOString();
      const approvalDate = new Date(approvalDateVal);
      
      // Calculate target date: Approval Date + (nextReviewNum * 15) days
      const daysToAdd = nextReviewNum * 15;
      approvalDate.setDate(approvalDate.getDate() + daysToAdd);
      const nextScheduledDateStr = approvalDate.toISOString().split('T')[0];

      const { error: scheduleNextErr } = await supabase
        .from('fortnight_reviews')
        .insert({
          student_id: review.student_id,
          review_number: nextReviewNum,
          scheduled_date: nextScheduledDateStr,
        });

      if (scheduleNextErr) {
        console.warn("Failed to automatically schedule next review:", scheduleNextErr.message);
      }
    }

    // Update student progress reports (timeline)
    const { error: timelineErr } = await supabase
      .from('student_progress_reports')
      .insert({
        student_id: review.student_id,
        teacher_id: params.interviewerId,
        progress_notes: `Completed Fortnight Review #${review.review_number}. Level assigned: ${params.assignedLevel}. Growth: ${growth}%. Recommendations: ${params.recommendations}`,
        improvement_percentage: growth,
      });

    if (timelineErr) {
      console.warn("Failed to update student progress timeline:", timelineErr.message);
    }

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

    // 7. Notify assigned teacher
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
        message: `Progress review #${review.review_number} for your student was completed. Growth: ${growth}%.`,
        read: false,
      });
    }

    // 8. Notify all admins of completion
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('approved', true);

    if (adminProfiles && adminProfiles.length > 0) {
      for (const admin of adminProfiles) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          student_id: review.student_id,
          role: 'admin',
          notification_type: 'progress_review_due',
          title: 'Progress Review Completed',
          message: `Review #${review.review_number} completed. New Level: ${params.assignedLevel}. Growth: ${growth}%.`,
          read: false,
        });
      }
    }

    // 9. If this is Review #3, send cycle-complete notification to student
    if (review.review_number >= 3) {
      await supabase.from('notifications').insert({
        user_id: review.student_id,
        student_id: review.student_id,
        role: 'student',
        notification_type: 'progress_review_due',
        title: '45-Day Review Cycle Complete',
        message: `Your 45-day review cycle is complete. Final assigned level: ${params.assignedLevel}. Well done!`,
        read: false,
      });
    }
  },
};
