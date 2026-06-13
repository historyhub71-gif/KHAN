import { Stack } from 'expo-router';
import React from 'react';

export default function DirectorLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="dashboard"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
