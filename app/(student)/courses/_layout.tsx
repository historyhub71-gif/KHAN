import { Stack } from 'expo-router';
import React from 'react';
import { Colors } from '../../../utils/colors';

export default function CoursesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: Colors.white,
        },
        headerTintColor: Colors.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: { backgroundColor: Colors.white },
      }}
    />
  );
}
