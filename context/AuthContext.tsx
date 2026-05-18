import React, { createContext, useEffect, useState } from "react";
import { authService } from "../services/authService";
import { AuthUser } from "../types";
import { supabase } from "../utils/supabase";

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

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        console.log('[AuthContext] Initializing auth...');
        setIsLoading(true);
        setError(null);

        // Timeout promise - increased to 30 seconds for slow connections
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth initialization timed out')), 30000)
        );

        // Actual auth promise
        const authPromise = (async () => {
          // Use getSession for fast initial check
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            console.log('[AuthContext] Session found, fetching profile...');
            const currentUser = await authService.getCurrentUser();
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
          } else if (result === 'rejected') {
            setAuthStatus('rejected');
            setUser(null);
          } else if (result) {
            setUser(result);
            setAuthStatus('approved');
          } else {
            setUser(null);
            setAuthStatus(null);
          }
        }
      } catch (err: any) {
        console.error("[AuthContext] Auth initialization error:", err);
        if (isMounted) {
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
          }
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) {
            try {
              const currentUser = await authService.getCurrentUser();
              if (isMounted) {
                if (currentUser === 'pending') {
                  setAuthStatus('pending');
                  setUser(null);
                } else if (currentUser === 'rejected') {
                  setAuthStatus('rejected');
                  setUser(null);
                } else if (currentUser) {
                  setUser(currentUser);
                  setAuthStatus('approved');
                } else {
                  setUser(null);
                  setAuthStatus(null);
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
      const currentUser = await authService.getCurrentUser();
      if (currentUser === 'pending') {
        setAuthStatus('pending');
        setUser(null);
      } else if (currentUser === 'rejected') {
        setAuthStatus('rejected');
        setUser(null);
      } else if (currentUser) {
        setUser(currentUser);
        setAuthStatus('approved');
      } else {
        setUser(null);
        setAuthStatus(null);
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
      
      // After signup, user is created with approved: false and status: pending
      // So they should be treated as pending
      setUser(null);
      setAuthStatus('pending');
      console.log('[AuthContext.signUp] State updated, user is pending');
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
      } else if (authenticatedUser === 'rejected') {
        setUser(null);
        setAuthStatus('rejected');
      } else {
        // If signIn returns 'pending' or null, treat as pending for now
        setUser(null);
        setAuthStatus('pending');
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