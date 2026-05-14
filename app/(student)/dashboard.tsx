import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { StudentCourseList } from '../../component/student/CourseCard';
import { useAuth } from '../../hooks/useAuth';
import { useCourses } from '../../hooks/useCourses';
import { Course } from '../../types';
import { useTheme } from '../../context/ThemeContext';

export default function StudentDashboardScreen() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { courses, isLoading, fetchCourses } = useCourses('student');

  // Redirect if not approved
  useEffect(() => {
    if (user && !user.approved) {
      router.replace('/(auth)/pending-approval');
    }
  }, [user?.approved]);

  useEffect(() => {
    if (!user && !authLoading) {
      router.replace('/(auth)/login');
    }
  }, [user, authLoading]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchCourses(user.id);
      }
    }, [user?.id, fetchCourses])
  );

  const handleNavigateToCourse = (course: Course) => {
    router.push({
      pathname: '/(student)/courses/[id]',
      params: { id: course.id },
    });
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <ScreenContainer>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.danger + '40' }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <MaterialIcons name="logout" size={22} color={colors.danger} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
            <Text style={[styles.userName, { color: colors.text }]}>{user?.name}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: colors.secondary + '10' }]}>
            <Text style={[styles.roleBadgeText, { color: colors.secondary }]}>STUDENT</Text>
          </View>
        </View>

        {/* Courses List */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Courses</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.surface }]}>
            <Text style={[styles.countText, { color: colors.textSecondary }]}>{courses.length}</Text>
          </View>
        </View>

        <StudentCourseList
          courses={courses}
          isLoading={isLoading}
          onCoursePress={handleNavigateToCourse}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  logoutButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
