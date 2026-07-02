import { Stack, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';

export default function StudentLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && (user.status !== 'approved' || !user.approved)) {
      router.replace('/(auth)/pending-approval');
    }
  }, [user, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="fees" options={{ title: 'Tuition Fees' }} />
    </Stack>
  );
}
