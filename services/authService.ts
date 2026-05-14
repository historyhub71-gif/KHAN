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
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.error('[authService.signUp] signUp error:', authError);
        throw authError;
      }
      
      if (!authData.user) {
        throw new Error('User creation failed');
      }

      console.log('[authService.signUp] User created, ID:', authData.user.id);
      console.log('[authService.signUp] Session available:', !!authData.session);

      let userId = authData.user.id;
      let userEmail = authData.user.email || email;

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

      console.log('[authService.signUp] Inserting profile for userId:', userId);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          name,
          role,
          approved: false,
        });

      if (profileError) {
        console.error('[authService.signUp] Profile insert error:', profileError);
        throw profileError;
      }

      console.log('[authService.signUp] Profile created successfully');
      return { id: userId, email: userEmail, name, role, approved: false };
    } catch (error) {
      console.error('[authService.signUp] Caught error:', error);
      throw error;
    }
  },

  signIn: async (email: string, password: string): Promise<AuthUser | null> => {
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
        // If profile fetch fails due to RLS (user not approved), return null
        if (profileError.code === 'PGRST116' || profileError.message?.includes('permission denied')) {
          console.log('[authService] Profile fetch failed due to RLS - user likely unapproved');
          return null;
        }
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

  getCurrentUser: async (): Promise<AuthUser | 'unapproved' | null> => {
    try {
      console.log('[authService] getCurrentUser starting...');
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

      console.log('[authService] User found:', user.id, 'fetching profile...');

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log('[authService] Profile fetch error code:', error.code);
        // If profile fetch fails due to RLS (user not approved), return 'unapproved'
        if (error.code === 'PGRST116' || error.message?.includes('permission denied')) {
          console.log('[authService] User is unapproved (RLS restriction)');
          return 'unapproved';
        }
        throw error;
      }

      console.log('[authService] Profile found:', profileData.role);
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