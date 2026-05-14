import { Stack } from 'expo-router';
import React from 'react';
import { Colors } from '../../utils/colors';

export default function TeacherLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: Colors.white,
        },
        headerTintColor: Colors.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: { backgroundColor: Colors.white },
      }}
    >
      <Stack.Screen name='dashboard' options={{title:"Teacher Dashboard"}}/>
    </Stack>
  );
}
