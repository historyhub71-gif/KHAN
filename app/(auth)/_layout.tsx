import { Stack } from 'expo-router';
import React from 'react';
import { Colors } from '../../utils/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.white },
      }}
    />
  );
}
