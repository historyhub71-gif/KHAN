import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { ResetPasswordForm } from '../component/auth/ResetPasswordForm';
import { ScreenContainer } from '../component/common/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../utils/supabase';
import {
  establishRecoverySessionFromUrl,
  hasRecoveryTokens,
  isRecoverySessionEstablished,
  isPasswordRecoveryActive,
  peekPendingRecoveryUrl,
  setPasswordRecoveryActive,
  setPendingRecoveryUrl,
} from '../utils/recoveryLink';

const VERIFY_TIMEOUT_MS = 3000;

export default function ResetPasswordScreen() {
  const { updatePassword, signOut, error } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const url = Linking.useURL();

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [isUpdating, setIsUpdating] = useState(false);

  const verifyRunIdRef = useRef(0);

  const markReady = useCallback(() => {
    setPasswordRecoveryActive(true);
    setSessionReady(true);
    setSessionError(null);
  }, []);

  const verifyRecoverySession = useCallback(async () => {
    const runId = ++verifyRunIdRef.current;
    setSessionError(null);

    if (isRecoverySessionEstablished()) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        markReady();
        return;
      }
    }

    const candidates = [
      peekPendingRecoveryUrl(),
      url,
      await Linking.getInitialURL(),
    ].filter((u): u is string => Boolean(u));

    for (const candidate of [...new Set(candidates)]) {
      if (runId !== verifyRunIdRef.current) return;
      if (!hasRecoveryTokens(candidate)) continue;

      const result = await establishRecoverySessionFromUrl(candidate);
      if (result.ok) {
        markReady();
        return;
      }
      if (result.error && result.error !== 'no_tokens') {
        setSessionError(result.error);
        return;
      }
    }

    if (runId !== verifyRunIdRef.current) return;

    const recovered = await new Promise<boolean>((resolve) => {
      let done = false;
      const timeout = setTimeout(() => {
        if (!done) resolve(false);
      }, VERIFY_TIMEOUT_MS);

      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          done = true;
          clearTimeout(timeout);
          authListener.subscription.unsubscribe();
          resolve(true);
        }
      });

      const linkSub = Linking.addEventListener('url', async (event) => {
        if (done || runId !== verifyRunIdRef.current) return;
        setPendingRecoveryUrl(event.url);
        if (hasRecoveryTokens(event.url)) {
          const result = await establishRecoverySessionFromUrl(event.url);
          if (result.ok) {
            done = true;
            clearTimeout(timeout);
            linkSub.remove();
            authListener.subscription.unsubscribe();
            resolve(true);
          }
        }
      });

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && isPasswordRecoveryActive() && !done) {
          done = true;
          clearTimeout(timeout);
          linkSub.remove();
          authListener.subscription.unsubscribe();
          resolve(true);
        }
      });
    });

    if (runId !== verifyRunIdRef.current) return;

    if (recovered || isRecoverySessionEstablished()) {
      markReady();
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      markReady();
      return;
    }

    setSessionError(
      'Could not verify the reset link. Request a new email, open it on this phone, and tap the link once.'
    );
  }, [url, markReady]);

  useEffect(() => {
    verifyRecoverySession();
    return () => {
      verifyRunIdRef.current += 1;
    };
  }, [verifyRecoverySession]);

  useEffect(() => {
    return () => setPasswordRecoveryActive(false);
  }, []);

  const handleUpdatePassword = async (password: string) => {
    if (!sessionReady) {
      Alert.alert('Please wait', 'Still verifying your reset link.');
      return;
    }

    try {
      setIsUpdating(true);
      setSuccessMessage(undefined);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Session expired', 'Please request another reset email.');
        return;
      }

      await updatePassword(password);
      setSuccessMessage('Password updated successfully!');

      Alert.alert(
        'Password updated',
        'Your password has been changed. Please log in with your new password.',
        [
          {
            text: 'Go to Login',
            onPress: async () => {
              setPasswordRecoveryActive(false);
              try {
                await signOut();
              } catch {
                // ignore
              }
              router.replace('/(auth)/login' as any);
            },
          },
        ],
        { cancelable: false }
      );
    } catch (err: unknown) {
      console.error('[ResetPassword] Update error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBackToLogin = async () => {
    setPasswordRecoveryActive(false);
    try {
      await signOut();
    } catch {
      // ignore
    }
    router.replace('/(auth)/login' as any);
  };

  if (sessionError) {
    return (
      <ScreenContainer>
        <View style={styles.errorBox}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Reset link invalid</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{sessionError}</Text>
          <Text
            style={[styles.link, { color: colors.primary }]}
            onPress={handleBackToLogin}
          >
            Back to Login
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.content}>
        {!sessionReady && (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Verifying reset link…
          </Text>
        )}
        <ResetPasswordForm
          onSubmit={handleUpdatePassword}
          onCancelPress={handleBackToLogin}
          isLoading={isUpdating || !sessionReady}
          error={error || undefined}
          successMessage={successMessage}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  hint: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  errorBox: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
