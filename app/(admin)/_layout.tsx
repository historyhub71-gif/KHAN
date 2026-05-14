import { Stack } from 'expo-router';
import React from 'react';
import { Colors } from '../../utils/colors';

export default function AdminLayout() {
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
      <Stack.Screen 
        name="dashboard" 
        options={{ title: 'Admin Dashboard' }} 
      />
      <Stack.Screen 
        name="teachers" 
        options={{ title: 'Manage Teachers' }} 
      />
      <Stack.Screen 
        name="students" 
        options={{ title: 'Manage Students' }} 
      />
      <Stack.Screen 
        name="courses" 
        options={{ title: 'Manage Course' }} 
      />
      <Stack.Screen 
        name="course-assignments" 
        options={{ title: 'Course Assignments' }} 
      />
    </Stack>
  );
}
