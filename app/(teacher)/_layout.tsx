import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function TeacherLayout() {
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
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Stack.Screen
        name="courses/[id]/student/[studentId]"
        options={{ title: 'Student Report' }}
      />
      <Stack.Screen name="attendance" options={{ title: 'Attendance Check-in' }} />
    </Stack>
  );
}
