import { AuthUser } from "../types";
import { supabase } from "../utils/supabase";

export const authService = {
  signUp: async (
    email: string,
    password: string,
    name: string,
    role: 'teacher' | 'student'
  ) => {
    try {
      console.log('[authService.signUp] Starting signup for email:', email);
      
      let userId: string;
      let userEmail = email;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('User already registered')) {
          console.log('[authService.signUp] User already registered. Attempting sign-in instead.');
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) {
            console.error('[authService.signUp] signIn error for existing user:', signInError);
            throw signInError;
          }
          
          if (!signInData.user) throw new Error('User sign-in failed after registration check');
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

        // If signup didn't return a session, try to sign in
        if (!authData.session) {
          console.log('[authService.signUp] No session from signup, attempting signin');
          
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
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

      // CHECK PROFILE STATUS BEFORE UPSERT TO PREVENT RE-REGISTERING REJECTED USERS
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', userId)
        .single();

      if (!existingProfileError && existingProfile?.status === 'rejected') {
        throw new Error('This account request was previously rejected.');
      }

      console.log('[authService.signUp] Upserting profile for userId:', userId);

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: userEmail,
          name,
          role,
          approved: false,
          status: 'pending',
        }, { onConflict: 'id', ignoreDuplicates: true });

      if (profileError) {
        console.error('[authService.signUp] Profile upsert error:', profileError);
        throw profileError;
      }

      console.log('[authService.signUp] Profile handled successfully');
      return { id: userId, email: userEmail, name, role, approved: false, status: 'pending' };
    } catch (error) {
      console.error('[authService.signUp] Caught error:', error);
      throw error;
    }
  },

  signIn: async (email: string, password: string): Promise<AuthUser | 'pending' | 'rejected' | null> => {
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
        if (profileError.code === 'PGRST116' || profileError.message?.includes('permission denied')) {
          console.log('[authService] Profile not found. Pushing error as requested.');
          throw new Error('Account not found. Your request may have been rejected or deleted.');
        }
        console.error('[authService] Profile fetch error:', profileError);
        throw profileError;
      }

      console.log('[authService] Profile fetched successfully:', profileData);
      
      if (profileData.status === 'rejected') return 'rejected';
      if (profileData.status === 'pending' || !profileData.approved) return 'pending';
      
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

  getCurrentUser: async (passedUserId?: string): Promise<AuthUser | 'pending' | 'rejected' | null> => {
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

      console.log('[authService] User found:', targetUserId, 'fetching profile...');

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error) {
        console.log('[authService] Profile fetch error code:', error.code);
        if (error.code === 'PGRST116' || error.message?.includes('permission denied')) {
          console.log('[authService] Profile not found. Returning null to force logout.');
          return null;
        }
        throw error;
      }

      console.log('[authService] Profile found:', profileData.role);
      
      if (profileData.status === 'rejected') return 'rejected';
      if (profileData.status === 'pending' || !profileData.approved) return 'pending';
      
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
};