import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { StudentCourseList } from '../../component/student/CourseCard';

import { StudentOverviewCard } from '../../component/student/StudentOverviewCard';
import { useNotificationContext } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useCourses } from '../../hooks/useCourses';
import { useStudentOverview } from '../../hooks/useStudentOverview';
import { studentService } from '../../services/studentService';
import { Attendance, Course, Notification } from '../../types';
import { supabase } from '../../utils/supabase';

const Tab = createBottomTabNavigator();

// ---------------------------------------------------------------------
// 1. Home Tab Screen
// ---------------------------------------------------------------------
interface HomeTabProps {
  user: any;
  overview: any;
  overviewLoading: boolean;
  notifications: Notification[];
  notifLoading: boolean;
  unreadCount: number;
  courses: Course[];
  coursesLoading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  router: any;
  handleNotificationPress: (item: Notification) => Promise<void>;
  colors: any;
  isDark: boolean;
  toggleTheme: () => void;
  onDeleteAlert: (id: string) => Promise<void>;
}

function HomeTabScreen({
  user,
  overview,
  overviewLoading,
  notifications,
  notifLoading,
  unreadCount,
  courses,
  coursesLoading,
  refreshing,
  onRefresh,
  router,
  handleNotificationPress,
  colors,
  isDark,
  toggleTheme,
  onDeleteAlert,
}: HomeTabProps) {
  const [isDismissing, setIsDismissing] = useState(false);

  // Filter for active attendance alerts (status = absent)
  const absentAlerts = notifications.filter((n) => {
    if (n.attendance) {
      return n.attendance.status === 'absent';
    }
    return (
      n.title === 'Attendance Alert' ||
      n.message?.toLowerCase().includes('absent')
    );
  });

  const latestAlert = absentAlerts.length > 0 ? absentAlerts[0] : null;

  // Reset dismissing state when the alert changes or disappears
  useEffect(() => {
    if (!latestAlert) {
      setIsDismissing(false);
    }
  }, [latestAlert]);

  const handleDismiss = async () => {
    if (!latestAlert || !onDeleteAlert) return;
    try {
      setIsDismissing(true);
      await onDeleteAlert(latestAlert.id);
    } catch (err) {
      console.error(err);
      setIsDismissing(false);
    }
  };

  const formatLogDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Extract info from latest alert
  const courseName =
    latestAlert?.courses?.name ||
    latestAlert?.message.split('in ').pop()?.replace('.', '') ||
    'Unknown Course';
  const dateStr =
    latestAlert?.attendance?.date ||
    (latestAlert?.created_at ? new Date(latestAlert.created_at).toISOString().split('T')[0] : '');
  const teacherName = latestAlert?.profiles?.name || 'Assigned Teacher';

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header Block */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
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
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/(student)/notifications' as Href)}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={24} color={colors.primary} />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Global Overview Card */}
        <StudentOverviewCard overview={overview} isLoading={overviewLoading} />

        {/* Quick Summary / Status */}
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statusIconContainer, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name="shield-checkmark" size={22} color={colors.success} />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Account Verified</Text>
            <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
              Approved by administration. Attendance tracking active.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Modern Red Warning Style Modal for Absent Attendance Alerts */}
      <Modal
        visible={!!latestAlert}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { }}
      >
        <View style={styles.alertModalOverlay}>
          <View style={[styles.alertModalContent, { backgroundColor: colors.surface, borderColor: colors.danger + '40' }]}>
            {/* Header Icon */}
            <View style={[styles.alertModalIconBg, { backgroundColor: colors.danger + '15' }]}>
              <Ionicons name="warning" size={32} color={colors.danger} />
            </View>

            <Text style={[styles.alertModalTitle, { color: colors.danger }]}>ATTENDANCE ALERT</Text>
            <Text style={[styles.alertModalSubtitle, { color: colors.textSecondary }]}>
              You have been marked ABSENT
            </Text>

            {/* Alert Details Card */}
            <View style={[styles.alertDetailsCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.detailRow}>
                <Ionicons name="book-outline" size={16} color={colors.primary} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Course:</Text>
                <Text style={[styles.detailVal, { color: colors.text }]} numberOfLines={1}>
                  {courseName}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date:</Text>
                <Text style={[styles.detailVal, { color: colors.text }]}>
                  {formatLogDate(dateStr)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color={colors.primary} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Teacher:</Text>
                <Text style={[styles.detailVal, { color: colors.text }]} numberOfLines={1}>
                  {teacherName}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status:</Text>
                <View style={[styles.alertStatusBadge, { backgroundColor: colors.danger + '15' }]}>
                  <Text style={[styles.alertStatusText, { color: colors.danger }]}>ABSENT</Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            {isDismissing ? (
              <ActivityIndicator size="small" color={colors.danger} style={{ marginVertical: 12 }} />
            ) : (
              <TouchableOpacity
                style={[styles.alertDismissBtn, { backgroundColor: colors.danger }]}
                onPress={handleDismiss}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.alertDismissBtnText}>Dismiss & Delete Alert</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 2. Attendance Tab Screen
// ---------------------------------------------------------------------
interface AttendanceTabProps {
  overview: any;
  overviewLoading: boolean;
  courses: Course[];
  attendanceLogs: Attendance[];
  logsLoading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  colors: any;
  notifications: Notification[];
  notifLoading: boolean;
  handleNotificationPress: (item: Notification) => Promise<void>;

  // Selection and deletion props
  selectedLogIds: Set<string>;
  setSelectedLogIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  isSelectionMode: boolean;
  setIsSelectionMode: (val: boolean) => void;
  showConfirmModal: boolean;
  setShowConfirmModal: (val: boolean) => void;
  onDeleteLogs: (ids: string[]) => Promise<void>;
  isDeleting: boolean;
}
function AttendanceTabScreen({
  overview,
  overviewLoading,
  courses,
  attendanceLogs,
  logsLoading,
  refreshing,
  onRefresh,
  colors,
  notifications,
  notifLoading,
  handleNotificationPress,
  selectedLogIds,
  setSelectedLogIds,
  isSelectionMode,
  setIsSelectionMode,
  showConfirmModal,
  setShowConfirmModal,
  onDeleteLogs,
  isDeleting,
}: AttendanceTabProps) {
  const getCourseName = (courseId: string) => {
    const course = courses.find((c) => c.id === courseId);
    return course ? course.name : 'Unknown Course';
  };

  const formatLogDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleLogPress = (logId: string) => {
    if (isSelectionMode) {
      setSelectedLogIds((prev) => {
        const next = new Set(prev);
        if (next.has(logId)) {
          next.delete(logId);
          if (next.size === 0) {
            setIsSelectionMode(false);
          }
        } else {
          next.add(logId);
        }
        return next;
      });
    }
  };

  const handleLogLongPress = (logId: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedLogIds(new Set([logId]));
    }
  };

  const handleSelectAll = () => {
    if (selectedLogIds.size === attendanceLogs.length) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(attendanceLogs.map((log) => log.id)));
    }
  };

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.tabHeader}>
          <Text style={[styles.tabTitle, { color: colors.text }]}>Attendance Center</Text>
          <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
            Detailed analysis and historic logs
          </Text>
        </View>

        {/* Global Statistics Card Grid */}
        <View style={styles.statsCardGrid}>
          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="checkmark" size={20} color={colors.success} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.success }]}>
              {overview?.totalPresent || 0}
            </Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Present Days</Text>
          </View>

          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.danger + '15' }]}>
              <Ionicons name="close" size={20} color={colors.danger} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.danger }]}>
              {overview?.totalAbsent || 0}
            </Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Absent Days</Text>
          </View>

          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="trending-up" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.primary }]}>
              {overview?.percentage ? `${overview.percentage}%` : '0%'}
            </Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Overall Rate</Text>
          </View>
        </View>
        {/* Recent Alerts section removed per requirements; alerts now only shown when student is marked absent. */}

        {/* Course Wise Attendance Progress */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="analytics" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Course Breakdown</Text>
          </View>
        </View>

        {courses.length === 0 ? (
          <View style={[styles.emptyBreakdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyBreakdownText, { color: colors.textSecondary }]}>
              No courses enrolled.
            </Text>
          </View>
        ) : (
          courses.map((course) => (
            <View
              key={course.id}
              style={[styles.courseRowItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.courseRowLeft}>
                <Text style={[styles.courseRowName, { color: colors.text }]} numberOfLines={1}>
                  {course.name}
                </Text>
                <Text style={[styles.courseRowCode, { color: colors.textSecondary }]}>
                  {course.code}
                </Text>
              </View>
              <View style={[styles.courseRowRate, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.courseRowRateText, { color: colors.primary }]}>
                  Active
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Recent Activity logs (Task 4) */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="time" size={20} color={colors.secondary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>History Logs</Text>
          </View>
          {attendanceLogs.length > 0 && (
            <View style={styles.headerActionRow}>
              {isSelectionMode ? (
                <>
                  <TouchableOpacity onPress={handleSelectAll} style={styles.actionBtn} activeOpacity={0.7}>
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                      {selectedLogIds.size === attendanceLogs.length ? 'Deselect' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowConfirmModal(true)}
                    disabled={selectedLogIds.size === 0}
                    style={[styles.actionBtn, { opacity: selectedLogIds.size === 0 ? 0.5 : 1 }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash" size={20} color={colors.danger} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedLogIds(new Set()); }} style={styles.actionBtn} activeOpacity={0.7}>
                    <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={() => setIsSelectionMode(true)} style={styles.actionBtn} activeOpacity={0.7}>
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Select</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {logsLoading && attendanceLogs.length === 0 ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 13 }}>Loading history...</Text>
          </View>
        ) : attendanceLogs.length === 0 ? (
          <View style={[styles.emptyBreakdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyBreakdownText, { color: colors.textSecondary }]}>
              No attendance logs found.
            </Text>
          </View>
        ) : (
          <View style={styles.logList}>
            {attendanceLogs.map((log) => {
              const isPresent = log.status === 'present';
              const isSelected = selectedLogIds.has(log.id);
              return (
                <TouchableOpacity
                  key={log.id}
                  activeOpacity={0.75}
                  onPress={() => isSelectionMode ? handleLogPress(log.id) : null}
                  onLongPress={() => handleLogLongPress(log.id)}
                  style={[
                    styles.logItem,
                    {
                      backgroundColor: isSelected ? colors.primary + '10' : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 1.5 : 1,
                    },
                  ]}
                >
                  <View style={styles.logItemLeftRow}>
                    {isSelectionMode && (
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={22}
                        color={isSelected ? colors.primary : colors.textSecondary}
                        style={{ marginRight: 10 }}
                      />
                    )}
                    <View style={styles.logItemLeft}>
                      <Text style={[styles.logItemCourse, { color: colors.text }]} numberOfLines={1}>
                        {getCourseName(log.course_id)}
                      </Text>
                      <Text style={[styles.logItemDate, { color: colors.textSecondary }]}>
                        {formatLogDate(log.date)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.logItemRight}>
                    <View
                      style={[
                        styles.logBadge,
                        {
                          backgroundColor: isPresent ? colors.success + '15' : colors.danger + '15',
                          borderColor: isPresent ? colors.success + '30' : colors.danger + '30',
                          marginRight: isSelectionMode ? 0 : 8,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isPresent ? 'checkmark-circle' : 'close-circle'}
                        size={14}
                        color={isPresent ? colors.success : colors.danger}
                      />
                      <Text style={[styles.logBadgeText, { color: isPresent ? colors.success : colors.danger }]}>
                        {isPresent ? 'Present' : 'Absent'}
                      </Text>
                    </View>

                    {!isSelectionMode && (
                      <TouchableOpacity
                        style={styles.singleDeleteBtn}
                        onPress={() => {
                          setSelectedLogIds(new Set([log.id]));
                          setShowConfirmModal(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Confirmation warning modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) setShowConfirmModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.modalIconBg, { backgroundColor: colors.danger + '15' }]}>
              <Ionicons name="warning-outline" size={28} color={colors.danger} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Attendance Logs?</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to permanently delete {selectedLogIds.size} attendance record{selectedLogIds.size > 1 ? 's' : ''}? This action cannot be undone and will affect your overall attendance rate in real-time.
            </Text>
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
            ) : (
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowConfirmModal(false);
                    if (!isSelectionMode) {
                      setSelectedLogIds(new Set());
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.deleteBtn, { backgroundColor: colors.danger }]}
                  onPress={() => onDeleteLogs(Array.from(selectedLogIds))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteBtnText}>Confirm Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 3. Courses Tab Screen
// ---------------------------------------------------------------------
interface CoursesTabProps {
  courses: Course[];
  coursesLoading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  handleNavigateToCourse: (course: Course) => void;
  colors: any;
}

function CoursesTabScreen({
  courses,
  coursesLoading,
  refreshing,
  onRefresh,
  handleNavigateToCourse,
  colors,
}: CoursesTabProps) {
  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.tabHeader}>
          <Text style={[styles.tabTitle, { color: colors.text }]}>My Courses</Text>
          <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
            All enrolled classes & calendars
          </Text>
        </View>

        <StudentCourseList
          courses={courses}
          isLoading={coursesLoading}
          onCoursePress={handleNavigateToCourse}
        />
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
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.profileAvatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          <View style={[styles.roleLabel, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.roleLabelText, { color: colors.primary }]}>STUDENT</Text>
          </View>
        </View>

        {/* Settings Info Groups */}
        <Text style={[styles.profileGroupTitle, { color: colors.textSecondary }]}>Account Details</Text>
        <View style={[styles.profileGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.profileRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>Verification Status</Text>
            <View style={[styles.badge, { backgroundColor: colors.success + '15', position: 'relative', top: 0, right: 0 }]}>
              <Text style={[styles.badgeText, { color: colors.success, fontSize: 11, fontWeight: '700' }]}>Approved</Text>
            </View>
          </View>
          <View style={[styles.profileRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>Registered Email</Text>
            <Text style={[styles.profileRowVal, { color: colors.text }]} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>User Type</Text>
            <Text style={[styles.profileRowVal, { color: colors.text }]}>Student Account</Text>
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
            onPress={() => router.push('/reset-password' as Href)}
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
export default function StudentDashboardScreen() {
  const { user, signOut, isInitializing: authLoading } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { courses, isLoading: coursesLoading, fetchCourses } = useCourses('student');
  const { overview, isLoading: overviewLoading, fetchOverview } = useStudentOverview(user?.id);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);


  // Deletion States
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const {
    notifications,
    unreadCount,
    isLoading: notifLoading,
    refresh: refreshNotifications,
    markRead,
    deleteNotifications,
  } = useNotificationContext();

  const fetchAttendanceLogs = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLogsLoading(true);
      const logs = await studentService.getAttendance(user.id);
      setAttendanceLogs(logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user && !user.approved) {
      router.replace('/(auth)/pending-approval');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user && !authLoading) {
      router.replace('/(auth)/login');
    }
  }, [user, authLoading, router]);

  // Stable refs so the realtime subscription effect only re-runs when user.id changes
  const fetchAttendanceLogsRef = useRef(fetchAttendanceLogs);
  const fetchOverviewRef = useRef(fetchOverview);
  useEffect(() => { fetchAttendanceLogsRef.current = fetchAttendanceLogs; }, [fetchAttendanceLogs]);
  useEffect(() => { fetchOverviewRef.current = fetchOverview; }, [fetchOverview]);

  // Realtime subscription for student attendance table changes
  useEffect(() => {
    if (!user?.id) return;

    console.log(`[StudentDashboardScreen] Setting up realtime subscription for attendance logs of student: ${user.id}`);
    const channel = supabase
      .channel(`student_attendance_logs:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `student_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[StudentDashboardScreen] Realtime attendance log change detected:', payload.eventType);
          fetchAttendanceLogsRef.current();
          fetchOverviewRef.current();
        }
      )
      .subscribe();

    return () => {
      console.log(`[StudentDashboardScreen] Cleaning up realtime attendance subscription for student: ${user.id}`);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleDeleteAlert = async (id: string) => {
    try {
      await deleteNotifications([id]);
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  };

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    await Promise.all([
      fetchCourses(user.id),
      fetchOverview(),
      fetchAttendanceLogs(),
      refreshNotifications(),
    ]);
  }, [user?.id, fetchCourses, fetchOverview, fetchAttendanceLogs, refreshNotifications]);

  // Load data when the screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadData();
      }
    }, [user?.id, loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
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

  const handleDeleteLogs = async (ids: string[]) => {
    try {
      setIsDeleting(true);
      await studentService.deleteAttendance(ids);
      setSelectedLogIds(new Set());
      setIsSelectionMode(false);
      setShowConfirmModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to delete logs:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Attendance') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Courses') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return (
            <View style={[styles.tabIconBg, focused && { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name={iconName} size={28} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0,
          height: 98,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
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
            overview={overview}
            overviewLoading={overviewLoading}
            notifications={notifications}
            notifLoading={notifLoading}
            unreadCount={unreadCount}
            courses={courses}
            coursesLoading={coursesLoading}
            refreshing={refreshing}
            onRefresh={onRefresh}
            router={router}
            handleNotificationPress={handleNotificationPress}
            colors={colors}
            isDark={isDark}
            toggleTheme={toggleTheme}
            onDeleteAlert={handleDeleteAlert}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Attendance">
        {() => (
          <AttendanceTabScreen
            overview={overview}
            overviewLoading={overviewLoading}
            courses={courses}
            attendanceLogs={attendanceLogs}
            logsLoading={logsLoading}
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={colors}
            notifications={notifications}
            notifLoading={notifLoading}
            handleNotificationPress={handleNotificationPress}
            selectedLogIds={selectedLogIds}
            setSelectedLogIds={setSelectedLogIds}
            isSelectionMode={isSelectionMode}
            setIsSelectionMode={setIsSelectionMode}
            showConfirmModal={showConfirmModal}
            setShowConfirmModal={setShowConfirmModal}
            onDeleteLogs={handleDeleteLogs}
            isDeleting={isDeleting}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Courses">
        {() => (
          <CoursesTabScreen
            courses={courses}
            coursesLoading={coursesLoading}
            refreshing={refreshing}
            onRefresh={onRefresh}
            handleNavigateToCourse={handleNavigateToCourse}
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
    color: '#fff',
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
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
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
  sectionHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sectionTitleRow: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '500',
  },
  seeAll: {
    fontSize: 19.5,
    fontWeight: '500',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    gap: 12,
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
  statsCardGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statsGridItem: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
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
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyBreakdown: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBreakdownText: {
    fontSize: 13,
  },
  courseRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  courseRowLeft: {
    flex: 1,
    paddingRight: 10,
  },
  courseRowName: {
    fontSize: 18,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  courseRowCode: {
    fontSize: 12,
    marginTop: 2,
  },
  courseRowRate: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  courseRowRateText: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  logList: {
    gap: 2,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  logItemLeft: {
    flex: 1,
    paddingLeft: 4,
  },
  logItemCourse: {
    fontSize: 17,
    fontWeight: '700',
  },
  logItemDate: {
    fontSize: 12,
    marginTop: 2,
  },
  logBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  logBadgeText: {
    fontSize: 19,
    fontWeight: '700',
  },
  profileCard: {
    alignItems: 'center',
    padding: 14,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 20,
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
    marginBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileEmail: {
    fontSize: 13.5,
    marginTop: 0,
  },
  roleLabel: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 9,
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

  // Task 3 & 4 additions
  alertContainer: {
    gap: 10,
  },
  alertCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#a53333ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  alertTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  alertMessage: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  alertTime: {
    fontSize: 10.5,
    marginTop: 6,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  logItemLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  singleDeleteBtn: {
    padding: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  modalIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  deleteBtn: {
    elevation: 2,
  },
  deleteBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },

  // Realtime Alert Modal Styles
  alertModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  alertModalIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  alertModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  alertModalSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    marginBottom: 20,
    textAlign: 'center',
  },
  alertDetailsCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 60,
  },
  detailVal: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  alertStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  alertDismissBtn: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  alertDismissBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
