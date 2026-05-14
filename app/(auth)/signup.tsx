import { useRouter } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SignupForm } from '../../component/auth/SignupForm';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useAuth } from '../../hooks/useAuth';

export default function SignupScreen() {
  const { signUp, error, isLoading } = useAuth();
  const router = useRouter();

  const handleSignUp = async (
    email: string,
    password: string,
    name: string,
    role: 'teacher' | 'student'
  ) => {
    try {
      await signUp(email, password, name, role);
      // AuthContext handles the navigation state by setting isUnapproved to true
    } catch (err: any) {
      console.error('[Signup] Sign-up error:', err);
    }
  };

  const handleSignInPress = () => {
    router.back();
  };

  return (
    <ScreenContainer>
      <SignupForm
        onSubmit={handleSignUp}
        onSignInPress={handleSignInPress}
        isLoading={isLoading} 
        error={error || undefined}
      />
    </ScreenContainer>
  );
}