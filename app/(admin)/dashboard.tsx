import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { supabase } from '../../utils/supabase';

const Tab = createBottomTabNavigator();

// ---------------------------------------------------------------------
// 1. Home Tab Screen
// ---------------------------------------------------------------------
interface HomeTabProps {
  user: any;
  stats: { teachers: number; students: number; courses: number };
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  router: any;
  colors: any;
}

function HomeTabScreen({
  user,
  stats,
  isLoading,
  refreshing,
  onRefresh,
  router,
  colors,
}: HomeTabProps) {
  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.danger }]}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </Text>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {user?.name}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.roleBadge, { backgroundColor: colors.danger + '15' }]}>
              <Text style={[styles.roleBadgeText, { color: colors.danger }]}>ADMIN</Text>
            </View>
          </View>
        </View>

        {/* Section Title */}
        <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary }]}>Platform Overview</Text>

        {/* Stats Grid */}
        <View style={styles.statsCardGrid}>
          {/* Teachers */}
          <TouchableOpacity
            style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(admin)/teachers')}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <MaterialIcons name="person" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.text }]}>{stats.teachers}</Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Approved Teachers</Text>
          </TouchableOpacity>

          {/* Students */}
          <TouchableOpacity
            style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(admin)/students')}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIconContainer, { backgroundColor: colors.warning + '15' }]}>
              <MaterialIcons name="school" size={24} color={colors.warning} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.text }]}>{stats.students}</Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Approved Students</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsCardGrid}>
          {/* Courses */}
          <TouchableOpacity
            style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(admin)/courses')}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIconContainer, { backgroundColor: colors.success + '15' }]}>
              <MaterialIcons name="class" size={24} color={colors.success} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.text }]}>{stats.courses}</Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Total Courses</Text>
          </TouchableOpacity>

          {/* System status */}
          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.secondary + '15' }]}>
              <MaterialIcons name="cloud-done" size={24} color={colors.secondary} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.success }]}>Online</Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>System Status</Text>
          </View>
        </View>

        {/* Tip Box */}
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statusIconContainer, { backgroundColor: colors.primary + '15' }]}>
            <MaterialIcons name="info-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Quick Tip</Text>
            <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
              {"Go to the \"Courses\" tab below to create courses and manage academic teacher/student assignments."}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 2. Attendance Tab Screen
// ---------------------------------------------------------------------
interface AttendanceTabProps {
  colors: any;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
}

function AttendanceTabScreen({ colors, refreshing, onRefresh }: AttendanceTabProps) {
  const [globalStats, setGlobalStats] = useState({ present: 0, absent: 0, total: 0, rate: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchGlobalStats = async () => {
    try {
      setStatsLoading(true);
      const { data, error } = await supabase.from('attendance').select('status');
      if (error) throw error;
      if (data && data.length > 0) {
        const present = data.filter((r) => r.status === 'present').length;
        const total = data.length;
        const absent = total - present;
        const rate = Math.round((present / total) * 100);
        setGlobalStats({ present, absent, total, rate });
      } else {
        setGlobalStats({ present: 0, absent: 0, total: 0, rate: 0 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalStats();
  }, [refreshing]);

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.tabHeader}>
          <Text style={[styles.tabTitle, { color: colors.text }]}>School Attendance Stats</Text>
          <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
            Aggregated system-wide records and calculations
          </Text>
        </View>

        {statsLoading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14, fontWeight: '600' }}>Loading attendance data...</Text>
          </View>
        ) : (
          <>
            {/* Rates dial card */}
            <View style={[styles.globalRateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.globalRateLabel, { color: colors.textSecondary }]}>Global Attendance Rate</Text>
              <Text style={[styles.globalRateVal, { color: colors.primary }]}>{globalStats.rate}%</Text>
              <View style={[styles.rateProgressBarBg, { backgroundColor: colors.border }]}>
                <View style={[styles.rateProgressBarFill, { width: `${globalStats.rate}%`, backgroundColor: colors.primary }]} />
              </View>
            </View>

            {/* Counts list */}
            <View style={styles.statsCardGrid}>
              <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.itemIconContainer, { backgroundColor: colors.success + '15' }]}>
                  <MaterialIcons name="check" size={20} color={colors.success} />
                </View>
                <Text style={[styles.gridItemVal, { color: colors.success }]}>{globalStats.present}</Text>
                <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Total Presents</Text>
              </View>

              <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.itemIconContainer, { backgroundColor: colors.danger + '15' }]}>
                  <MaterialIcons name="close" size={20} color={colors.danger} />
                </View>
                <Text style={[styles.gridItemVal, { color: colors.danger }]}>{globalStats.absent}</Text>
                <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Total Absents</Text>
              </View>
            </View>

            <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
              <View style={[styles.statusIconContainer, { backgroundColor: colors.success + '15' }]}>
                <MaterialIcons name="assessment" size={22} color={colors.success} />
              </View>
              <View style={styles.statusTextContainer}>
                <Text style={[styles.statusTitle, { color: colors.text }]}>Total Records Logs</Text>
                <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
                  The platform has registered a total of {globalStats.total} attendance logs.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 3. Courses Tab Screen (Academic Management Panel)
// ---------------------------------------------------------------------
interface CoursesTabProps {
  router: any;
  colors: any;
}

function CoursesTabScreen({ router, colors }: CoursesTabProps) {
  const adminActions = [
    {
      title: 'Manage Teachers',
      desc: 'Approve profiles & list teachers',
      icon: 'people-outline',
      route: '/(admin)/teachers',
      color: colors.primary,
    },
    {
      title: 'Manage Students',
      desc: 'Approve profiles & list students',
      icon: 'school',
      route: '/(admin)/students',
      color: colors.warning,
    },
    {
      title: 'Manage Courses',
      desc: 'Create, update & delete courses',
      icon: 'class',
      route: '/(admin)/courses',
      color: colors.success,
    },
    {
      title: 'Course Assignments',
      desc: 'Assign teachers & enroll students',
      icon: 'assignment-ind',
      route: '/(admin)/course-assignments',
      color: colors.secondary,
    },
  ];

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabHeader}>
          <Text style={[styles.tabTitle, { color: colors.text }]}>Academic Management</Text>
          <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
            Configure students, teachers, courses, and assignments
          </Text>
        </View>

        <View style={styles.actionsGrid}>
          {adminActions.map((action) => (
            <TouchableOpacity
              key={action.title}
              style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(action.route)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: action.color + '15' }]}>
                <MaterialIcons name={action.icon as any} size={28} color={action.color} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={[styles.actionCardTitle, { color: colors.text }]}>{action.title}</Text>
                <Text style={[styles.actionCardDesc, { color: colors.textSecondary }]}>{action.desc}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 4. Profile Tab Screen
// ---------------------------------------------------------------------
interface ProfileTabProps {
  user: any;
  colors: any;
  isDark: boolean;
  toggleTheme: () => void;
  handleLogout: () => Promise<void>;
  router: any;
}

function ProfileTabScreen({
  user,
  colors,
  isDark,
  toggleTheme,
  handleLogout,
  router,
}: ProfileTabProps) {
  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.profileAvatar, { backgroundColor: colors.danger }]}>
            <Text style={styles.profileAvatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          <View style={[styles.roleLabel, { backgroundColor: colors.danger + '15' }]}>
            <Text style={[styles.roleLabelText, { color: colors.danger }]}>ADMINISTRATOR</Text>
          </View>
        </View>

        {/* Settings Info Groups */}
        <Text style={[styles.profileGroupTitle, { color: colors.textSecondary }]}>System Credentials</Text>
        <View style={[styles.profileGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.profileRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>Status</Text>
            <View style={[styles.badge, { backgroundColor: colors.success + '15', position: 'relative', top: 0, right: 0 }]}>
              <Text style={[styles.badgeText, { color: colors.success, fontSize: 11, fontWeight: '700' }]}>Active</Text>
            </View>
          </View>
          <View style={[styles.profileRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>Admin Email</Text>
            <Text style={[styles.profileRowVal, { color: colors.text }]} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>Access Rights</Text>
            <Text style={[styles.profileRowVal, { color: colors.text }]}>Full System Access</Text>
          </View>
        </View>

        <Text style={[styles.profileGroupTitle, { color: colors.textSecondary }]}>Preferences</Text>
        <View style={[styles.profileGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.profileSwitchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.text} />
              <Text style={[styles.switchLabel, { color: colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        <Text style={[styles.profileGroupTitle, { color: colors.textSecondary }]}>Security</Text>
        <View style={[styles.profileGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.profileRowClickable}
            onPress={() => router.push('/reset-password')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
              <Text style={[styles.clickableRowText, { color: colors.text }]}>Reset Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Action Logout */}
        <TouchableOpacity
          style={[styles.logoutBtnFull, { backgroundColor: colors.danger + '12', borderColor: colors.danger + '30' }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[styles.logoutBtnText, { color: colors.danger }]}>Sign Out of App</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// MAIN ENTRY: Bottom Tab Navigator Controller
// ---------------------------------------------------------------------
export default function AdminDashboardScreen() {
  const { user, signOut, isInitializing: authLoading } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();

  const [stats, setStats] = useState({
    teachers: 0,
    students: 0,
    courses: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setIsLoading(true);
      }

      const [teachers, students, courses] = await Promise.all([
        adminService.getTeachers(),
        adminService.getStudents(),
        adminService.getCourses(),
      ]);

      // Only approved users count
      const approvedTeachers = teachers.filter((t) => t.approved === true);
      const approvedStudents = students.filter((s) => s.approved === true);

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
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  useEffect(() => {
    if (!user && !authLoading) {
      router.replace('/(auth)/login');
    }
  }, [user, authLoading, router]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchStats(true);
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

  if (!user) return null;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Attendance') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'Courses') {
            iconName = focused ? 'folder-open' : 'folder-open-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return (
            <View style={styles.tabIconBg}>
              <Ionicons name={iconName} size={24} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: colors.danger,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0,
          height: 98,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 12,
          shadowColor: '#9b1313ff',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: -2,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home">
        {() => (
          <HomeTabScreen
            user={user}
            stats={stats}
            isLoading={isLoading}
            refreshing={refreshing}
            onRefresh={onRefresh}
            router={router}
            colors={colors}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Attendance">
        {() => (
          <AttendanceTabScreen
            colors={colors}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Courses">
        {() => (
          <CoursesTabScreen
            router={router}
            colors={colors}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {() => (
          <ProfileTabScreen
            user={user}
            colors={colors}
            isDark={isDark}
            toggleTheme={toggleTheme}
            handleLogout={handleLogout}
            router={router}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ---------------------------------------------------------------------
// Professional Premium StyleSheet
// ---------------------------------------------------------------------
const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 36,
  },
  tabIconBg: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarText: {
    color: '#dddcdcff',
    fontSize: 18,
    fontWeight: '800',
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
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
  sectionTitleLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 6,
    marginBottom: 12,
  },
  statsCardGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statsGridItem: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  itemIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridItemVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  gridItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginTop: 20,
  },
  statusIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  tabHeader: {
    marginBottom: 20,
  },
  tabTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  tabSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  globalRateCard: {
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  globalRateLabel: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  globalRateVal: {
    fontSize: 40,
    fontWeight: '900',
    marginVertical: 12,
  },
  rateProgressBarBg: {
    height: 8,
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  rateProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionsGrid: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionCardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  profileCard: {
    alignItems: 'center',
    padding: 0,
    borderRadius: 22,
    borderWidth: 0,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  profileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileEmail: {
    fontSize: 13.5,
    marginTop: 0,
  },
  roleLabel: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 5,
  },
  roleLabelText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileGroupTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 6,
    marginBottom: 8,
    marginTop: 16,
  },
  profileGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
  },
  profileRowLabel: {
    fontSize: 13.5,
    fontWeight: '400',
  },
  profileRowVal: {
    fontSize: 13.5,
    fontWeight: '200',
    maxWidth: '60%',
  },
  profileSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  profileRowClickable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  rowIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clickableRowText: {
    fontSize: 13.5,
    fontWeight: '600',
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
    fontSize: 9.5,
    fontWeight: '800',
  },
  logoutBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 24,
  },
  logoutBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
});