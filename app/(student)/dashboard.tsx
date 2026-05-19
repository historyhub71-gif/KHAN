import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { StudentCourseList } from '../../component/student/CourseCard';
import { NotificationList } from '../../component/student/NotificationList';
import { StudentOverviewCard } from '../../component/student/StudentOverviewCard';
import { useNotificationContext } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { useCourses } from '../../hooks/useCourses';
import { useStudentOverview } from '../../hooks/useStudentOverview';
import { Course, Notification } from '../../types';
import { useTheme } from '../../context/ThemeContext';

export default function StudentDashboardScreen() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { courses, isLoading, fetchCourses } = useCourses('student');
  const { overview, isLoading: overviewLoading, fetchOverview } = useStudentOverview(user?.id);
  const [refreshing, setRefreshing] = useState(false);
  const {
    notifications,
    unreadCount,
    isLoading: notifLoading,
    error: notifError,
    markRead,
    refresh: refreshNotifications,
  } = useNotificationContext();

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
        fetchOverview();
      }
    }, [user?.id])
  );

  const onRefresh = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    await Promise.all([
      fetchCourses(user.id),
      fetchOverview(),
      refreshNotifications(),
    ]);
    setRefreshing(false);
  };

  const handleNavigateToCourse = (course: Course) => {
    router.push({
      pathname: '/(student)/courses/[id]',
      params: { id: course.id },
    });
  };

  const handleNotificationPress = async (item: Notification) => {
    if (!item.read) {
      await markRead(item.id);
    }
    router.push('/(student)/notifications' as Href);
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
        style={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(student)/notifications' as Href)}
          >
            <MaterialIcons name="notifications" size={22} color={colors.primary} />
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <StudentOverviewCard overview={overview} isLoading={overviewLoading} />


        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent alerts</Text>
          <TouchableOpacity onPress={() => router.push('/(student)/notifications' as Href)}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>
        <NotificationList
          notifications={notifications}
          isLoading={notifLoading}
          onPress={handleNotificationPress}
          compact
        />

        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
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
    marginBottom: 24,
    gap: 8,
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
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 13,
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
  errorBanner: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
});
