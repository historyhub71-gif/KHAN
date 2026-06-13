import { Interview, Profile, StudentProgressReview } from '../types';
import { supabase } from '../utils/supabase';

export const interviewerService = {
  // Get newly registered students who don't have an admission interview yet
  getNewStudents: async (): Promise<Profile[]> => {
    const { data: students, error: studentError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .eq('approved', false)
      .eq('status', 'pending');

    if (studentError) throw studentError;

    const { data: interviews, error: interviewError } = await supabase
      .from('interviews')
      .select('student_id')
      .eq('interview_type', 'admission')
      .is('deleted_at', null);

    if (interviewError) throw interviewError;

    const interviewedIds = new Set(interviews?.map((i) => i.student_id) || []);

    return (students || []).filter((s) => !interviewedIds.has(s.id));
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
    const { data, error } = await supabase
      .from('student_progress_reviews')
      .select('*, profiles:student_id(name)')
      .is('completed_at', null)
      .order('scheduled_date', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      student_name: row.profiles?.name,
    }));
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
    const { data: review, error: reviewErr } = await supabase
      .from('student_progress_reviews')
      .select('*')
      .eq('id', params.reviewId)
      .single();

    if (reviewErr) throw reviewErr;

    const { data: prevInterview, error: prevErr } = await supabase
      .from('interviews')
      .select('total_score')
      .eq('id', review.admission_interview_id)
      .single();

    if (prevErr) throw prevErr;

    const newTotal = params.english + params.communication + params.confidence + params.technicalSkills + params.learningAbility;
    const growth = prevInterview.total_score > 0
      ? Math.round(((newTotal - prevInterview.total_score) / prevInterview.total_score) * 100)
      : 0;

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

    const { error: updateReviewErr } = await supabase
      .from('student_progress_reviews')
      .update({
        review_interview_id: newInterview.id,
        completed_at: new Date().toISOString(),
        growth_report: `Growth comparison complete. Previous total score was ${prevInterview.total_score}, current total is ${newTotal}. Improvement percentage: ${growth}%. Notes: ${params.recommendations}`,
        improvement_percentage: growth,
      })
      .eq('id', params.reviewId);

    if (updateReviewErr) throw updateReviewErr;

    await supabase
      .from('student_profiles')
      .update({ level: params.assignedLevel })
      .eq('id', review.student_id);

    await supabase.from('notifications').insert({
      user_id: review.student_id,
      role: 'student',
      notification_type: 'progress_review_due',
      title: 'Progress Review Complete',
      message: `Your 14-day progress review is complete. Growth rate: ${growth}%.`,
      read: false,
    });

    const { data: sp } = await supabase
      .from('student_profiles')
      .select('assigned_teacher_id')
      .eq('id', review.student_id)
      .single();

    if (sp?.assigned_teacher_id) {
      await supabase.from('notifications').insert({
        user_id: sp.assigned_teacher_id,
        role: 'teacher',
        notification_type: 'progress_review_due',
        title: 'Student Progress Review Complete',
        message: `Progress review for student was completed. Growth rate: ${growth}%.`,
        read: false,
      });
    }
  },
};
