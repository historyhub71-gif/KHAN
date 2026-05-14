import { useRouter } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LoginForm } from '../../component/auth/LoginForm';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useAuth } from '../../hooks/useAuth';

export default function LoginScreen() {
  const { signIn, error, user, isUnapproved, isLoading } = useAuth();
  const router = useRouter();

  const handleSignIn = async (email: string, password: string) => {
    try {
      await signIn(email, password);
    } catch (err: any) {
      console.error('[Login] Sign-in error:', err);
    }
  };

  // Watch for user state changes and navigate after successful signin
  React.useEffect(() => {
    if (user && !isLoading && !isUnapproved) {
      if (user.role === 'admin') {
        router.replace('/(admin)/dashboard');
      } else if (user.role === 'teacher') {
        router.replace('/(teacher)/dashboard');
      } else if (user.role === 'student') {
        router.replace('/(student)/dashboard');
      }
    }
  }, [user, isUnapproved, isLoading]);

  // Navigate to pending approval if user is unapproved
  React.useEffect(() => {
    if (isUnapproved && !isLoading) {
      router.replace('/(auth)/pending-approval');
    }
  }, [isUnapproved, isLoading, router]);

  const handleSignUpPress = () => {
    router.push('/(auth)/signup');
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <LoginForm
          onSubmit={handleSignIn}
          onSignUpPress={handleSignUpPress}
          isLoading={isLoading}
          error={error || undefined}
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