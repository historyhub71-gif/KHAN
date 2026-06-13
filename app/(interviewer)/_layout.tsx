import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function InterviewerLayout() {
  const { colors } = useTheme();

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
      <Stack.Screen name="history" options={{ title: 'Assessment History' }} />
    </Stack>
  );
}
