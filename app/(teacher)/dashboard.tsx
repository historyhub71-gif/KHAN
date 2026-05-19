import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Href, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { TeacherCourseList } from '../../component/teacher/CourseCard';
import { useAuth } from '../../hooks/useAuth';
import { teacherService } from '../../services/teacherService';
import { Course } from '../../types';
import { useTheme } from '../../context/ThemeContext';

export default function TeacherDashboardScreen() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const fetchCourses = useCallback(async () => {
    try {
      if (courses.length === 0) {
        setIsLoading(true);
      }
      if (!user?.id) return;
      const data = await teacherService.getCourses(user.id);
      setCourses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, courses.length]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchCourses();
      }
    }, [user?.id, fetchCourses])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCourses();
    setRefreshing(false);
  };

  const handleNavigateToCourse = (course: Course) => {
    router.push({
      pathname: '/(teacher)/courses/[id]',
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

  if (!user) return null;

  return (
    <ScreenContainer>
      <ScrollView 
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
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
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={toggleTheme}
          >
            <MaterialIcons
              name={isDark ? 'light-mode' : 'dark-mode'}
              size={22}
              color={colors.text}
            />
          </TouchableOpacity>
          <View style={[styles.roleBadge, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.roleBadgeText, { color: colors.primary }]}>TEACHER</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.analyticsCard, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => router.push('/(teacher)/analytics' as Href)}
          activeOpacity={0.85}
        >
          <MaterialIcons name="analytics" size={28} color={colors.white} />
          <View style={styles.analyticsText}>
            <Text style={styles.analyticsTitle}>Analytics Dashboard</Text>
            <Text style={styles.analyticsSubtitle}>
              Today&apos;s stats, student rates & history
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Courses</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.surface }]}>
            <Text style={[styles.countText, { color: colors.textSecondary }]}>{courses.length}</Text>
          </View>
        </View>
        
        <TeacherCourseList
          courses={courses}
          isLoading={isLoading}
          onCoursePress={handleNavigateToCourse}
        />
      </ScrollView>
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
    marginBottom: 20,
    gap: 8,
  },
  logoutButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
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
  analyticsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
  },
  analyticsText: {
    flex: 1,
  },
  analyticsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  analyticsSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 4,
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
