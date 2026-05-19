import React, { createContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import { AuthUser } from "../types";
import { supabase } from "../utils/supabase";

const CACHE_KEYS = {
  USER: '@attendance_tracker_cached_user',
  STATUS: '@attendance_tracker_cached_status',
};

interface AuthContextType {
  user: AuthUser | null;
  authStatus: 'approved' | 'pending' | 'rejected' | null;
  isUnapproved: boolean;
  isLoading: boolean;
  error: string | null;
  signUp: (
    email: string,
    password: string,
    name: string,
    role: "teacher" | "student"
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  authStatus: null,
  isUnapproved: false,
  isLoading: true,
  error: null,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  refreshAuth: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'approved' | 'pending' | 'rejected' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        console.log('[AuthContext] Initializing auth...');
        setIsLoading(true);
        setError(null);

        // 1. FAST PATH: Load cached credentials instantly
        try {
          const [cachedUserStr, cachedStatus] = await Promise.all([
            AsyncStorage.getItem(CACHE_KEYS.USER),
            AsyncStorage.getItem(CACHE_KEYS.STATUS),
          ]);
          
          if (cachedUserStr && cachedStatus && isMounted) {
            const cachedUser = JSON.parse(cachedUserStr) as AuthUser;
            console.log('[AuthContext] Loaded cached user profile:', cachedUser.role);
            setUser(cachedUser);
            setAuthStatus(cachedStatus as any);
            setIsLoading(false); // Transitions instantly to dashboard!
          }
        } catch (cacheErr) {
          console.error('[AuthContext] Error loading auth cache:', cacheErr);
        }

        // Timeout promise - reduced to 10 seconds since we have a fast path/cache
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth initialization timed out')), 10000)
        );

        // Actual auth promise
        const authPromise = (async () => {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            console.log('[AuthContext] Session found, fetching profile...');
            const currentUser = await authService.getCurrentUser(session.user.id);
            return currentUser;
          }
          return null;
        })();

        // Race against timeout
        const result = await Promise.race([authPromise, timeoutPromise]) as AuthUser | 'pending' | 'rejected' | null;

        if (isMounted) {
          if (result === 'pending') {
            setAuthStatus('pending');
            setUser(null);
            await saveCache(null, 'pending');
          } else if (result === 'rejected') {
            setAuthStatus('rejected');
            setUser(null);
            await saveCache(null, 'rejected');
          } else if (result) {
            setUser(result);
            setAuthStatus('approved');
            await saveCache(result, 'approved');
          } else {
            setUser(null);
            setAuthStatus(null);
            await clearCache();
          }
        }
      } catch (err: any) {
        console.error("[AuthContext] Auth initialization error:", err);
        // Keep cached credentials active if network check fails
        const cachedUserStr = await AsyncStorage.getItem(CACHE_KEYS.USER);
        if (cachedUserStr) {
          console.log('[AuthContext] Network error, keeping active cache.');
        } else if (isMounted) {
          setError(err.message === 'Auth initialization timed out' 
            ? "Connection is slow. Please check your internet and try again." 
            : "Failed to initialize authentication");
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          console.log('[AuthContext] Initialization complete, isLoading: false');
        }
      }
    };

    initializeAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] onAuthStateChange event:', event);
        
        if (event === 'SIGNED_OUT') {
          if (isMounted) {
            setUser(null);
            setAuthStatus(null);
            setIsLoading(false);
            await clearCache();
          }
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) {
            try {
              const currentUser = await authService.getCurrentUser(session.user.id);
              if (isMounted) {
                if (currentUser === 'pending') {
                  setAuthStatus('pending');
                  setUser(null);
                  await saveCache(null, 'pending');
                } else if (currentUser === 'rejected') {
                  setAuthStatus('rejected');
                  setUser(null);
                  await saveCache(null, 'rejected');
                } else if (currentUser) {
                  setUser(currentUser);
                  setAuthStatus('approved');
                  await saveCache(currentUser, 'approved');
                } else {
                  setUser(null);
                  setAuthStatus(null);
                  await clearCache();
                }
                setIsLoading(false);
              }
            } catch (err) {
              console.error('[AuthContext] Error in onAuthStateChange:', err);
            }
          }
        }
      }
    );

    return () => {
      isMounted = false;
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
      if (currentUser === 'pending') {
        setAuthStatus('pending');
        setUser(null);
        await saveCache(null, 'pending');
      } else if (currentUser === 'rejected') {
        setAuthStatus('rejected');
        setUser(null);
        await saveCache(null, 'rejected');
      } else if (currentUser) {
        setUser(currentUser);
        setAuthStatus('approved');
        await saveCache(currentUser, 'approved');
      } else {
        setUser(null);
        setAuthStatus(null);
        await clearCache();
      }
    } catch (err: any) {
      setError("Failed to refresh authentication");
      console.error('[AuthContext.refreshAuth] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: "teacher" | "student"
  ) => {
    try {
      console.log('[AuthContext.signUp] Starting signup');
      setError(null);
      setIsLoading(true);
      
      console.log('[AuthContext.signUp] Calling authService.signUp');
      const newUser = await authService.signUp(email, password, name, role);
      
      console.log('[AuthContext.signUp] authService.signUp completed, result:', newUser);
      
      setUser(null);
      setAuthStatus('pending');
      await saveCache(null, 'pending');
    } catch (err: any) {
      console.error('[AuthContext.signUp] Error caught:', err);
      const errorMessage = err.message || "Sign up failed";
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
      console.log('[AuthContext] signIn called with email:', email);
      const authenticatedUser = await authService.signIn(email, password);
      console.log('[AuthContext] signIn successful, user:', authenticatedUser);
      
      if (authenticatedUser && typeof authenticatedUser !== 'string') {
        setUser(authenticatedUser);
        setAuthStatus('approved');
        await saveCache(authenticatedUser, 'approved');
      } else if (authenticatedUser === 'rejected') {
        setUser(null);
        setAuthStatus('rejected');
        await saveCache(null, 'rejected');
      } else {
        setUser(null);
        setAuthStatus('pending');
        await saveCache(null, 'pending');
      }
    } catch (err: any) {
      const errorMessage = err.message || "Sign in failed";
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
      await clearCache();
      console.log('signout completed');
    } catch (err: any) {
      const errorMessage = err.message || "Sign out failed";
      console.error('[AuthContext] signOut error:', errorMessage);
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
        isLoading,
        error,
        signUp,
        signIn,
        signOut,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};