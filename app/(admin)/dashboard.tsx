import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button } from '../../component/common/Button';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';

export default function AdminDashboardScreen() {
  const { user, signOut, isLoading: authLoading } = useAuth();

  const {
    colors,
    isDark,
    toggleTheme,
  } = useTheme();

  const router = useRouter();

  const [stats, setStats] = useState({
    teachers: 0,
    students: 0,
    courses: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (!user && !authLoading) {
      router.replace('/(auth)/login');
    }
  }, [user, authLoading]);

  const fetchStats = async () => {
    try {
      setIsLoading(true);

      const [teachers, students, courses] = await Promise.all([
        adminService.getTeachers(),
        adminService.getStudents(),
        adminService.getCourses(),
      ]);

      // Only approved users count
      const approvedTeachers = teachers.filter(
        (t) => t.approved === true
      );

      const approvedStudents = students.filter(
        (s) => s.approved === true
      );

      setStats({
        teachers: approvedTeachers.length,
        students: approvedStudents.length,
        courses: courses.length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchStats();
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
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
      <ScrollView
        style={[
          styles.scroll,
          { backgroundColor: colors.background },
        ]}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          {/* Theme Toggle */}
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={isDark ? 'light-mode' : 'dark-mode'}
              size={22}
              color={colors.text}
            />
          </TouchableOpacity>

          {/* User Info */}
          <View style={styles.headerTextContainer}>
            <Text
              style={[
                styles.greeting,
                { color: colors.textSecondary },
              ]}
            >
              Welcome back,
            </Text>

            <Text
              style={[
                styles.userName,
                { color: colors.text },
              ]}
            >
              {user?.name}
            </Text>
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.danger + '40',
              },
            ]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="logout"
              size={22}
              color={colors.danger}
            />
          </TouchableOpacity>
        </View>

        {/* Role Badge */}
        <View
          style={[
            styles.roleBadge,
            { backgroundColor: colors.primary + '15' },
          ]}
        >
          <Text
            style={[
              styles.roleBadgeText,
              { color: colors.primary },
            ]}
          >
            ADMIN DASHBOARD
          </Text>
        </View>

        {/* Section Title */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text },
          ]}
        >
          Platform Overview
        </Text>

        {/* Loading */}
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />
          </View>
        ) : (
          <View style={styles.statsGrid}>
            {/* Teachers */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.statIconContainer,
                  {
                    backgroundColor:
                      colors.primary + '15',
                  },
                ]}
              >
                <MaterialIcons
                  name="person-outline"
                  size={24}
                  color={colors.primary}
                />
              </View>

              <Text
                style={[
                  styles.statValue,
                  { color: colors.text },
                ]}
              >
                {stats.teachers}
              </Text>

              <Text
                style={[
                  styles.statLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Teachers
              </Text>
            </View>

            {/* Students */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.statIconContainer,
                  {
                    backgroundColor:
                      colors.warning + '15',
                  },
                ]}
              >
                <MaterialIcons
                  name="school"
                  size={24}
                  color={colors.warning}
                />
              </View>

              <Text
                style={[
                  styles.statValue,
                  { color: colors.text },
                ]}
              >
                {stats.students}
              </Text>

              <Text
                style={[
                  styles.statLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Students
              </Text>
            </View>

            {/* Courses */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.statIconContainer,
                  {
                    backgroundColor:
                      colors.success + '15',
                  },
                ]}
              >
                <MaterialIcons
                  name="class"
                  size={24}
                  color={colors.success}
                />
              </View>

              <Text
                style={[
                  styles.statValue,
                  { color: colors.text },
                ]}
              >
                {stats.courses}
              </Text>

              <Text
                style={[
                  styles.statLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Courses
              </Text>
            </View>
          </View>
        )}

        {/* Menu */}
        <View style={styles.menuContainer}>
          <Button
            title="Manage Teachers"
            onPress={() =>
              router.push('/(admin)/teachers')
            }
            fullWidth
            style={styles.menuButton}
          />

          <Button
            title="Manage Students"
            onPress={() =>
              router.push('/(admin)/students')
            }
            fullWidth
            variant="secondary"
            style={styles.menuButton}
          />

          <Button
            title="Manage Courses"
            onPress={() =>
              router.push('/(admin)/courses')
            }
            fullWidth
            variant="success"
            style={styles.menuButton}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },

  container: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },

  iconButton: {
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
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 24,
  },

  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },

  loaderContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },

  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },

  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },

  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  statValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  menuContainer: {
    gap: 12,
  },

  menuButton: {
    marginBottom: 4,
    borderRadius: 16,
    height: 56,
  },
});