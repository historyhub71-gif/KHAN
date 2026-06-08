import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { ForgotPasswordForm } from '../../component/auth/ForgotPasswordForm';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useAuth } from '../../hooks/useAuth';

export default function ForgotPasswordScreen() {
  const { resetPassword, error, isLoading } = useAuth();
  const router = useRouter();
  const [successMessage, setSuccessMessage] = useState<string | undefined>(undefined);
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  const handleResetPassword = async (email: string) => {
    try {
      // Clear previous state before each attempt
      setSuccessMessage(undefined);
      setLocalError(undefined);

      await resetPassword(email);
      setSuccessMessage('Password reset link sent! Please check your inbox and spam folder.');

      Alert.alert(
        'Email Sent! ✉️',
        'A password reset link has been sent to your email address. Please open it on this device to reset your password.',
        [
          {
            text: 'OK',
            // Navigate explicitly to login — router.back() can silently fail
            // if the navigation stack is empty
            onPress: () => router.replace('/(auth)/login' as any),
          }
        ],
        { cancelable: false }
      );
    } catch (err: any) {
      console.error('[ForgotPassword] Reset password error:', err);
      setLocalError(err.message || 'Failed to send reset email. Please try again.');
    }
  };

  const handleBackToLogin = () => {
    router.replace('/(auth)/login' as any);
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <ForgotPasswordForm
          onSubmit={handleResetPassword}
          onBackToLoginPress={handleBackToLogin}
          isLoading={isLoading}
          error={localError || error || undefined}
          successMessage={successMessage}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
