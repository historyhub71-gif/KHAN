import { supabase } from '../utils/supabase';

export const ADMISSION_SIGNUP_ERROR =
  'Your admission process has not been completed yet. Please contact administration.';

type SignupEligibilityResponse = {
  eligible?: boolean;
  admission_status?: string | null;
  student_account_status?: string | null;
  deal_id?: string | null;
  interview_id?: string | null;
  reason?: string | null;
};

export const admissionValidationService = {
  validateStudentSignupEligibility: async (email: string): Promise<SignupEligibilityResponse> => {
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.rpc('validate_student_signup_eligibility', {
      p_email: normalizedEmail,
    });

    if (error) {
      console.error('[admissionValidationService] Eligibility RPC failed:', error);
      throw new Error(ADMISSION_SIGNUP_ERROR);
    }

    const result = (data || {}) as SignupEligibilityResponse;

    if (!result.eligible) {
      throw new Error(ADMISSION_SIGNUP_ERROR);
    }

    return result;
  },
};
