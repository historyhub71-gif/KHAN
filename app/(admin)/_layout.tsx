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
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="teachers" 
        options={{ title: 'Manage Staff' }} 
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
      <Stack.Screen 
        name="interviews" 
        options={{ title: 'Interview Analytics' }} 
      />
      <Stack.Screen 
        name="fees" 
        options={{ title: 'Fee Approvals' }} 
      />
      <Stack.Screen 
        name="admission-fees" 
        options={{ title: 'Admission Fees' }} 
      />
      <Stack.Screen 
        name="teacher-attendance" 
        options={{ title: 'Teacher Attendance' }} 
      />
      <Stack.Screen 
        name="salaries" 
        options={{ title: 'Teacher Salaries' }} 
      />
      <Stack.Screen 
        name="reports" 
        options={{ title: 'Academic Reports' }} 
      />
    </Stack>
  );
}
