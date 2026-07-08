import React, { createContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import { AuthUser } from "../types";
import { supabase } from "../utils/supabase";
import {
  isPasswordRecoveryActive,
  peekPendingRecoveryUrl,
  setPasswordRecoveryActive,
} from "../utils/recoveryLink";

const CACHE_KEYS = {
  USER: '@attendance_tracker_cached_user',
  STATUS: '@attendance_tracker_cached_status',
};

interface AuthContextType {
  user: AuthUser | null;
  authStatus: 'approved' | 'pending' | 'rejected' | null;
  isUnapproved: boolean;
  /** True only while the app is starting (splash / index). Not used for button taps. */
  isInitializing: boolean;
  /** True while sign-in, sign-up, reset email, etc. — buttons only. */
  isLoading: boolean;
  error: string | null;
  signUp: (
    email: string,
    password: string,
    name: string,
    role: "teacher" | "student" | "interviewer"
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  authStatus: null,
  isUnapproved: false,
  isInitializing: true,
  isLoading: false,
  error: null,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  refreshAuth: async () => {},
  resetPassword: async () => {},
  updatePassword: async () => {},
});

/** Returns true if the error message indicates a stale / invalid refresh token. */
const isInvalidTokenError = (err: any): boolean => {
  const msg: string = err?.message ?? err?.error_description ?? '';
  return (
    msg.includes('Invalid Refresh Token') ||
    msg.includes('Refresh Token Not Found') ||
    msg.includes('refresh_token_not_found')
  );
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'approved' | 'pending' | 'rejected' | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveCache = async (cachedUser: AuthUser | null, status: string | null) => {
    try {
      if (cachedUser) {
        await AsyncStorage.setItem(CACHE_KEYS.USER, JSON.stringify(cachedUser));
      } else {
        await AsyncStorage.removeItem(CACHE_KEYS.USER);
      }
      if (status) {
        await AsyncStorage.setItem(CACHE_KEYS.STATUS, status);
      } else {
        await AsyncStorage.removeItem(CACHE_KEYS.STATUS);
      }
    } catch (e) {
      console.error('[AuthContext] Failed to save auth cache:', e);
    }
  };

  const clearCache = async () => {
    try {
      await AsyncStorage.multiRemove([CACHE_KEYS.USER, CACHE_KEYS.STATUS]);
    } catch (e) {
      console.error('[AuthContext] Failed to clear auth cache:', e);
    }
  };

  /** Resolves auth user from a Supabase session user and updates state. */
  const applyUserSession = async (
    userId: string,
    isMounted: () => boolean,
    finallySetInitializing = false
  ) => {
    const currentUser = await authService.getCurrentUser(userId);
    if (!isMounted()) return;
    if (currentUser) {
      setUser(currentUser);
      if (currentUser.status === 'rejected') {
        setAuthStatus('rejected');
        await saveCache(currentUser, 'rejected');
      } else if (
        currentUser.status === 'pending' ||
        currentUser.status === 'waiting_approval' ||
        !currentUser.approved
      ) {
        setAuthStatus('pending');
        await saveCache(currentUser, 'pending');
      } else {
        setAuthStatus('approved');
        await saveCache(currentUser, 'approved');
      }
    } else {
      setUser(null);
      setAuthStatus(null);
      await clearCache();
    }
    if (finallySetInitializing && isMounted()) setIsInitializing(false);
  };

  useEffect(() => {
    let mounted = true;
    const isMounted = () => mounted;

    const initializeAuth = async () => {
      try {
        setError(null);

        const recoveryPending =
          isPasswordRecoveryActive() || Boolean(peekPendingRecoveryUrl());

        if (recoveryPending) {
          if (mounted) setIsInitializing(false);
          return;
        }

        // Optimistically restore cached session while we verify with the server
        try {
          const [cachedUserStr, cachedStatus] = await Promise.all([
            AsyncStorage.getItem(CACHE_KEYS.USER),
            AsyncStorage.getItem(CACHE_KEYS.STATUS),
          ]);
          if (cachedUserStr && cachedStatus && mounted) {
            const cachedUser = JSON.parse(cachedUserStr) as AuthUser;
            setUser(cachedUser);
            setAuthStatus(cachedStatus as any);
          }
        } catch (cacheErr) {
          console.error('[AuthContext] Error loading auth cache:', cacheErr);
        }

        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Auth initialization timed out')), 15000)
        );

        const authPromise = (async (): Promise<AuthUser | null> => {
          if (isPasswordRecoveryActive()) {
            console.log('[AuthContext] Password recovery in progress — skip profile load');
            return null;
          }

          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          // Stale / expired refresh token — clear local state and treat as logged out
          if (sessionError) {
            if (isInvalidTokenError(sessionError)) {
              console.log('[AuthContext] Stale refresh token on init, clearing session.');
              try { await supabase.auth.signOut(); } catch (_) {}
              await clearCache();
              return null;
            }
            throw sessionError;
          }

          if (session?.user) {
            console.log('[AuthContext] Session found, fetching profile...');
            return authService.getCurrentUser(session.user.id);
          }
          return null;
        })();

        const result = await Promise.race([authPromise, timeoutPromise]);

        if (mounted) {
          if (result) {
            setUser(result);
            if (result.status === 'rejected') {
              setAuthStatus('rejected');
              await saveCache(result, 'rejected');
            } else if (
              result.status === 'pending' ||
              result.status === 'waiting_approval' ||
              !result.approved
            ) {
              setAuthStatus('pending');
              await saveCache(result, 'pending');
            } else {
              setAuthStatus('approved');
              await saveCache(result, 'approved');
            }
          } else {
            setUser(null);
            setAuthStatus(null);
            await clearCache();
          }
        }
      } catch (err: any) {
        // Stale token bubbled through the race — handle gracefully
        if (isInvalidTokenError(err)) {
          console.log('[AuthContext] Invalid refresh token caught, signing out silently.');
          try { await supabase.auth.signOut(); } catch (_) {}
          if (mounted) {
            setUser(null);
            setAuthStatus(null);
            await clearCache();
          }
        } else if (err?.message === 'Auth initialization timed out') {
          console.log('[AuthContext] Auth init timed out (cold start / slow connection).');
          const cachedUserStr = await AsyncStorage.getItem(CACHE_KEYS.USER);
          if (cachedUserStr) {
            console.log('[AuthContext] Timeout — keeping active cache.');
          } else if (mounted) {
            setError('Connection is slow. Please check your internet and try again.');
            setUser(null);
          }
        } else {
          console.warn('[AuthContext] Auth initialization error:', err);
          const cachedUserStr = await AsyncStorage.getItem(CACHE_KEYS.USER);
          if (cachedUserStr) {
            console.log('[AuthContext] Network error, keeping active cache.');
          } else if (mounted) {
            setError('Failed to initialize authentication');
            setUser(null);
          }
        }
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };

    initializeAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] onAuthStateChange event:', event);

        if (event === 'SIGNED_OUT') {
          if (mounted) {
            setUser(null);
            setAuthStatus(null);
            setIsInitializing(false);
            await clearCache();
          }
          return;
        }

        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecoveryActive(true);
          if (mounted) setIsInitializing(false);
          return;
        }

        if (isPasswordRecoveryActive()) {
          if (mounted) setIsInitializing(false);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) {
            try {
              await applyUserSession(session.user.id, isMounted, true);
            } catch (err: any) {
              if (isInvalidTokenError(err)) {
                // Token became invalid mid-session — sign out silently
                console.log('[AuthContext] Invalid refresh token in state change, signing out.');
                try { await supabase.auth.signOut(); } catch (_) {}
                if (mounted) {
                  setUser(null);
                  setAuthStatus(null);
                  await clearCache();
                  setIsInitializing(false);
                }
              } else {
                console.error('[AuthContext] Error in onAuthStateChange:', err);
              }
            }
          }
        }
      }
    );

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const refreshAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        setAuthStatus(null);
        await clearCache();
        return;
      }
      const currentUser = await authService.getCurrentUser(session.user.id);
      if (currentUser) {
        setUser(currentUser);
        if (currentUser.status === 'rejected') {
          setAuthStatus('rejected');
          await saveCache(currentUser, 'rejected');
        } else if (
          currentUser.status === 'pending' ||
          currentUser.status === 'waiting_approval' ||
          !currentUser.approved
        ) {
          setAuthStatus('pending');
          await saveCache(currentUser, 'pending');
        } else {
          setAuthStatus('approved');
          await saveCache(currentUser, 'approved');
        }
      } else {
        setUser(null);
        setAuthStatus(null);
        await clearCache();
      }
    } catch (err: any) {
      setError('Failed to refresh authentication');
      console.error('[AuthContext.refreshAuth] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: "teacher" | "student" | "interviewer"
  ) => {
    try {
      console.log('[AuthContext.signUp] Starting signup');
      setError(null);
      setIsLoading(true);
      // Mark auth as settled so screens don't flash login during sign-up flow
      setIsInitializing(false);

      console.log('[AuthContext.signUp] Calling authService.signUp');
      const newUser = await authService.signUp(email, password, name, role);

      console.log('[AuthContext.signUp] authService.signUp completed, result:', newUser);

      setUser(newUser);
      if (newUser.status === 'rejected') {
        setAuthStatus('rejected');
        await saveCache(newUser, 'rejected');
      } else if (
        newUser.status === 'pending' ||
        newUser.status === 'waiting_approval' ||
        !newUser.approved
      ) {
        setAuthStatus('pending');
        await saveCache(newUser, 'pending');
      } else {
        setAuthStatus('approved');
        await saveCache(newUser, 'approved');
      }
    } catch (err: any) {
      console.error('[AuthContext.signUp] Error caught:', err);
      const errorMessage = err.message || 'Sign up failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
      console.log('[AuthContext.signUp] isLoading set to false');
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      // Mark auth as settled immediately so dashboard guards don't flash login
      setIsInitializing(false);
      console.log('[AuthContext] signIn called with email:', email);
      const authenticatedUser = await authService.signIn(email, password);
      console.log('[AuthContext] signIn successful, user:', authenticatedUser);

      if (authenticatedUser) {
        setUser(authenticatedUser);
        if (authenticatedUser.status === 'rejected') {
          setAuthStatus('rejected');
          await saveCache(authenticatedUser, 'rejected');
        } else if (
          authenticatedUser.status === 'pending' ||
          authenticatedUser.status === 'waiting_approval' ||
          !authenticatedUser.approved
        ) {
          setAuthStatus('pending');
          await saveCache(authenticatedUser, 'pending');
        } else {
          setAuthStatus('approved');
          await saveCache(authenticatedUser, 'approved');
        }
      } else {
        setUser(null);
        setAuthStatus(null);
        await clearCache();
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Sign in failed';
      console.error('[AuthContext] signIn error:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      console.log('inside signout function called');
      setError(null);
      setIsLoading(true);
      await authService.signOut();
      setUser(null);
      setAuthStatus(null);
      setIsInitializing(false);
      await clearCache();
      console.log('signout completed');
    } catch (err: any) {
      const errorMessage = err.message || 'Sign out failed';
      console.error('[AuthContext] signOut error:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setError(null);
      setIsLoading(true);
      await authService.resetPassword(email);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send password reset email';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      await authService.updatePassword(password);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update password';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const isUnapproved = authStatus === 'pending';

  return (
    <AuthContext.Provider
      value={{
        user,
        authStatus,
        isUnapproved,
        isInitializing,
        isLoading,
        error,
        signUp,
        signIn,
        signOut,
        refreshAuth,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
