import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { PASSWORD_RESET_REDIRECT } from "../constants/deepLinking";
import { AuthUser } from "../types";
import { supabase } from "../utils/supabase";
import {
  ADMISSION_SIGNUP_ERROR,
  admissionValidationService,
} from "./admissionValidationService";

export const authService = {
  signUp: async (
    email: string,
    password: string,
    name: string,
    role: 'teacher' | 'student' | 'interviewer'
  ) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      console.log('[authService.signUp] Starting signup for email:', normalizedEmail);

      let userId: string;
      let userEmail = normalizedEmail;

      if (role === 'student') {
        await admissionValidationService.validateStudentSignupEligibility(normalizedEmail);

        console.log('[authService.signUp] Student eligible. Running complete_approved_student_signup RPC...');
        const { error: activationError } = await supabase.rpc('complete_approved_student_signup', {
          p_email: normalizedEmail,
          p_password: password,
          p_name: name,
        });

        if (activationError) {
          console.error('[authService.signUp] approved student activation error:', activationError);
          throw new Error(activationError.message || ADMISSION_SIGNUP_ERROR);
        }

        console.log('[authService.signUp] RPC successful. Attempting sign-in...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInError) {
          console.error('[authService.signUp] signIn error for activated student:', signInError);
          throw signInError;
        }

        if (!signInData.user) {
          throw new Error('User sign-in failed after activation');
        }

        userId = signInData.user.id;
        userEmail = signInData.user.email || normalizedEmail;
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              name,
              role,
            }
          }
        });

        if (authError) {
          if (authError.message?.toLowerCase().includes('already registered')) {
            console.log('[authService.signUp] User already registered. Attempting sign-in instead.');

            const { data: signInData, error: signInError } =
              await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
              });

            if (signInError) {
              console.error('[authService.signUp] signIn error for existing user:', signInError);
              throw signInError;
            }

            if (!signInData.user) {
              throw new Error('User sign-in failed after registration check');
            }

            userId = signInData.user.id;
            userEmail = signInData.user.email || email;
          } else {
            console.error('[authService.signUp] signUp error:', authError);
            throw authError;
          }
        } else {
          if (!authData.user) {
            throw new Error('User creation failed');
          }

          userId = authData.user.id;
          userEmail = authData.user.email || email;

          if (!authData.session) {
            console.log('[authService.signUp] No session from signup, attempting signin');

            const { data: signInData, error: signInError } =
              await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
              });

            if (signInError) {
              console.error('[authService.signUp] signIn error:', signInError);
              throw signInError;
            }

            console.log('[authService.signUp] SignIn successful');

            userId = signInData.user?.id || userId;
            userEmail = signInData.user?.email || userEmail;
          }
        }
      }

      const { data: existingProfile, error: existingProfileError } =
        await supabase
          .from('profiles')
          .select('status')
          .eq('id', userId)
          .single();

      if (!existingProfileError && existingProfile?.status === 'rejected') {
        throw new Error('This account request was previously rejected.');
      }

      console.log('[authService.signUp] Inserting profile for userId:', userId);
      /*
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          name,
          role,
          approved: false,
          status: 'pending',
        });S

      if (profileError) {
        if (
          profileError.code === '23505' ||
          profileError.message?.includes('duplicate key') ||
          profileError.message?.includes('already exists')
        ) {
          console.log('[authService.signUp] Profile already exists, ignoring duplicate key error.');
        } else {
          console.error('[authService.signUp] Profile insert error:', profileError);
          throw profileError;
        }
      }
     */
      console.log('[authService.signUp] Profile handled successfully');

      // Read the actual profile to get the status set by handle_new_user trigger
      // (it may have set waiting_approval if admission_deals email matched)
      const { data: finalProfile } = await supabase
        .from('profiles')
        .select('id, email, name, role, approved, status, created_at')
        .eq('id', userId)
        .single();

      const returnStatus = finalProfile?.status || (role === 'student' ? 'approved' : 'pending');

      return {
        id: userId,
        email: userEmail,
        name: finalProfile?.name || name,
        role: (finalProfile?.role || role) as 'teacher' | 'student' | 'interviewer',
        approved: finalProfile?.approved ?? false,
        status: returnStatus,
        created_at: finalProfile?.created_at || new Date().toISOString(),
      };
    } catch (error) {
      console.error('[authService.signUp] Caught error:', error);
      throw error;
    }
  },

  signIn: async (
    email: string,
    password: string
  ): Promise<AuthUser | null> => {
    try {
      console.log('[authService] Starting sign-in for email:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[authService] Auth error:', error);
        throw error;
      }

      console.log('[authService] Auth successful, fetching profile for user:', data.user.id);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('[authService] Profile fetch error:', profileError);
        throw profileError;
      }

      console.log('[authService] Profile fetched successfully:', profileData);

      return profileData as AuthUser;
    } catch (error) {
      console.error('[authService] Sign-in failed:', error);
      throw error;
    }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;
  },

  getCurrentUser: async (
    passedUserId?: string
  ): Promise<AuthUser | null> => {
    try {
      console.log('[authService] getCurrentUser starting...');

      let targetUserId = passedUserId;

      if (!targetUserId) {
        const {
          data: { user },
          error: authError
        } = await supabase.auth.getUser();

        if (authError) {
          console.error('[authService] getUser error:', authError);
          return null;
        }

        if (!user) {
          console.log('[authService] No user found in session');
          return null;
        }

        targetUserId = user.id;
      }

      console.log('[authService] User found:', targetUserId);

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error) {
        console.error('[authService] Profile fetch error:', error);
        return null;
      }

      return profileData as AuthUser;
    } catch (error) {
      console.error('[authService] getCurrentUser error:', error);
      return null;
    }
  },

  updateProfile: async (userId: string, updates: Partial<AuthUser>) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return data as AuthUser;
  },

  resetPassword: async (email: string) => {
    try {
      console.log('[authService] resetPassword called for email:', email);

      const redirectTo =
        Platform.OS === 'web'
          ? Linking.createURL('/reset-password')
          : PASSWORD_RESET_REDIRECT;

      console.log('[authService] resetPassword redirect URL:', redirectTo, {
        scheme: PASSWORD_RESET_REDIRECT.split('://')[0],
      });

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        console.error('[authService] resetPassword error:', error);
        throw error;
      }

      console.log('[authService] resetPassword email sent successfully');
    } catch (error) {
      console.error('[authService] resetPassword failed:', error);
      throw error;
    }
  },

  updatePassword: async (password: string) => {
    try {
      console.log('[authService] updatePassword called');

      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) {
        console.error('[authService] updatePassword error:', error);
        throw error;
      }

      console.log('[authService] password updated successfully');
    } catch (error) {
      console.error('[authService] updatePassword failed:', error);
      throw error;
    }
  },
};
