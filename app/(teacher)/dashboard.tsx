import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { Href, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { dashboardService } from '../../services/dashboardService';
import { teacherService } from '../../services/teacherService';
import { Course } from '../../types';
import { supabase } from '../../utils/supabase';


// Analytics components and hook
import { StatCard } from '../../component/common/StatCard';
import { AnalyticsSummary } from '../../component/teacher/AnalyticsSummary';
import { AttendanceHistoryByDateList } from '../../component/teacher/AttendanceHistoryByDate';
import { FrequentAbsenteesList } from '../../component/teacher/FrequentAbsenteesList';
import { StudentAnalyticsList } from '../../component/teacher/StudentAnalyticsList';
import { useTeacherAnalytics } from '../../hooks/useTeacherAnalytics';

const Tab = createBottomTabNavigator();

// ---------------------------------------------------------------------
// 1. Home Tab Screen
// ---------------------------------------------------------------------
interface HomeTabProps {
  user: any;
  courses: Course[];
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  router: any;
  colors: any;
  isDark: boolean;
  toggleTheme: () => void;
}

function HomeTabScreen({
  user,
  courses,
  isLoading,
  refreshing,
  onRefresh,
  router,
  colors,
  isDark,
  toggleTheme,
}: HomeTabProps) {
  const totalClasses = courses.length;

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
                {user?.name ? user.name.charAt(0).toUpperCase() : 'T'}
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
            <View style={[styles.roleBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.roleBadgeText, { color: colors.primary }]}>TEACHER</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats Grid */}
        <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary }]}>Summary Overview</Text>
        <View style={styles.statsCardGrid}>
          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="book" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.text }]}>{totalClasses}</Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Total Courses</Text>
          </View>

          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="shield-checkmark" size={22} color={colors.success} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.success }]}>Active</Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Status</Text>
          </View>
        </View>

        {/* Quick Guide card */}
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statusIconContainer, { backgroundColor: colors.secondary + '15' }]}>
            <Ionicons name="information-circle" size={22} color={colors.secondary} />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Quick Tip</Text>
            <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
              {"Click the \"Attendance\" tab below to quickly register daily attendance sheets for your assigned classes."}
            </Text>
          </View>
        </View>

        {/* Check-in/out Shortcut Card */}
        <TouchableOpacity
          style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}
          onPress={() => router.push('/(teacher)/attendance')}
          activeOpacity={0.7}
        >
          <View style={[styles.statusIconContainer, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="time" size={22} color={colors.primary} />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Daily Attendance Check-in</Text>
            <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
              Perform your daily check-in/out and view status.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={{ marginRight: 4 }} />
        </TouchableOpacity>

      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 2. Attendance Tab Screen
// ---------------------------------------------------------------------
interface AttendanceTabProps {
  courses: Course[];
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  handleNavigateToCourse: (course: Course) => void;
  colors: any;
}

function AttendanceTabScreen({
  courses,
  isLoading,
  refreshing,
  onRefresh,
  handleNavigateToCourse,
  colors,
}: AttendanceTabProps) {
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
          <Text style={[styles.tabTitle, { color: colors.text }]}>Register Attendance</Text>
          <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
            Select a course to record or update attendance sheets
          </Text>
        </View>

        {isLoading && courses.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14, fontWeight: '600' }}>
              Loading assigned courses...
            </Text>
          </View>
        ) : courses.length === 0 ? (
          <View style={[styles.emptyStateContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="book-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Courses Assigned</Text>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Contact administration to assign courses to your account.
            </Text>
          </View>
        ) : (
          <View style={styles.courseQuickMarkList}>
            {courses.map((course) => (
              <View
                key={course.id}
                style={[styles.quickMarkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.quickMarkInfo}>
                  <Text style={[styles.quickMarkTitle, { color: colors.text }]} numberOfLines={1}>
                    {course.name}
                  </Text>
                  <Text style={[styles.quickMarkCode, { color: colors.textSecondary }]}>
                    {course.code}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.quickMarkBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleNavigateToCourse(course)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="create-outline" size={16} color={colors.white} style={{ marginRight: 2 }} />
                  <Text style={[styles.quickMarkBtnText, { color: colors.white }]}>Mark</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 3. Analytics Tab Screen (Renamed from Courses, moved from analytics.tsx)
// ---------------------------------------------------------------------
interface AnalyticsTabProps {
  user: any;
  colors: any;
}

function AnalyticsTabScreen({ user, colors }: AnalyticsTabProps) {
  const {
    courses,
    selectedCourseId,
    dailyStats,
    courseSummary,
    studentAnalytics,
    frequentAbsentees,
    historyByDate,
    isLoading,
    error,
    fetchCourses,
    fetchAnalytics,
    selectCourse,
  } = useTeacherAnalytics(user?.id);

  const [refreshing, setRefreshing] = useState(false);
  const [dismissedAbsenteeIds, setDismissedAbsenteeIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchCourses();
        if (selectedCourseId) {
          fetchAnalytics(selectedCourseId);
        }
      }
    }, [user?.id, fetchCourses, selectedCourseId, fetchAnalytics])
  );

  useEffect(() => {
    if (selectedCourseId) {
      fetchAnalytics(selectedCourseId);
    }
  }, [selectedCourseId, fetchAnalytics]);

  // Realtime subscription for course attendance changes (teachers get updates instantly)
  useEffect(() => {
    if (!selectedCourseId) return;

    console.log(`[AnalyticsTabScreen] Setting up realtime subscription for course attendance: ${selectedCourseId}`);
    const channel = supabase
      .channel(`course_attendance_analytics:${selectedCourseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `course_id=eq.${selectedCourseId}`,
        },
        (payload) => {
          console.log('[AnalyticsTabScreen] Realtime attendance change detected, refreshing analytics:', payload.eventType);
          fetchAnalytics(selectedCourseId);
        }
      )
      .subscribe();

    return () => {
      console.log(`[AnalyticsTabScreen] Cleaning up realtime subscription for course: ${selectedCourseId}`);
      supabase.removeChannel(channel);
    };
  }, [selectedCourseId, fetchAnalytics]);

  const handleDeleteHistoryByDate = useCallback((date: string) => {
    if (!selectedCourseId) return;

    Alert.alert(
      'Delete Attendance Records',
      `Are you sure you want to permanently delete all attendance records for this course on ${date}? This action cannot be undone and will update your analytics in real-time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await teacherService.deleteAttendanceByDate(selectedCourseId, date);
              Alert.alert('Success', 'Attendance records deleted successfully');
            } catch (err: any) {
              console.error(err);
              Alert.alert('Error', err.message || 'Failed to delete attendance records');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [selectedCourseId]);

  const onRefresh = async () => {
    setRefreshing(true);
    setDismissedAbsenteeIds(new Set());
    await fetchCourses();
    if (selectedCourseId) {
      await fetchAnalytics(selectedCourseId);
    }
    setRefreshing(false);
  };

  const handleDismissAbsentee = (studentId: string) => {
    setDismissedAbsenteeIds((prev) => new Set([...prev, studentId]));
  };

  const visibleAbsentees = frequentAbsentees.filter(
    (s) => !dismissedAbsenteeIds.has(s.student.id)
  );

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
          <Text style={[styles.tabTitle, { color: colors.text }]}>Analytics Dashboard</Text>
          <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
            Course-wide summaries, history, and absenteeism
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coursePicker}>
          {courses.map((course) => {
            const active = course.id === selectedCourseId;
            return (
              <TouchableOpacity
                key={course.id}
                style={[
                  styles.courseChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => selectCourse(course.id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.courseChipText,
                    { color: active ? colors.white : colors.text },
                  ]}
                >
                  {course.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        {isLoading && courses.length === 0 ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14, fontWeight: '600' }}>
              Fetching course analytics...
            </Text>
          </View>
        ) : courses.length === 0 ? (
          <View style={[styles.emptyStateContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="bar-chart-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Courses Assigned</Text>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Contact administration to assign courses to your account to view analytics.
            </Text>
          </View>
        ) : (
          <>
            {/* Daily Attendance Analytics */}
            <Text style={[styles.sectionTitleLabel, { color: colors.text, marginTop: 8 }]}>
              Daily Attendance Analytics
            </Text>
            <AnalyticsSummary stats={dailyStats} />
            <View style={styles.rateRow}>
              <StatCard
                icon="percent"
                label="Today's rate"
                value={`${dailyStats?.attendanceRateToday ?? 0}%`}
              />
            </View>

            {/* Course Attendance Summary */}
            <Text style={[styles.sectionTitleLabel, { color: colors.text, marginTop: 16 }]}>
              Course Attendance Summary
            </Text>
            <View style={styles.summaryRow}>
              <StatCard
                icon="groups"
                label="Total Students"
                value={courseSummary?.totalStudents ?? 0}
              />
              <StatCard
                icon="check-circle"
                label="Present Count"
                value={courseSummary?.totalPresent ?? 0}
                color={colors.success}
              />
              <StatCard
                icon="cancel"
                label="Absent Count"
                value={courseSummary?.totalAbsent ?? 0}
                color={colors.danger}
              />
            </View>
            <View style={styles.rateRow}>
              <StatCard
                icon="percent"
                label="Attendance Percentage"
                value={`${courseSummary?.overallPercentage ?? 0}%`}
              />
            </View>

            {/* Frequently Absent Section */}
            <View style={styles.frequentHeader}>
              <Ionicons name="warning" size={18} color={colors.danger} />
              <Text style={[styles.sectionTitleLabel, { color: colors.danger, marginBottom: 0, marginLeft: 6 }]}>
                Frequently Absent (3+ absences)
              </Text>
            </View>
            <Text style={[styles.frequentSubtitle, { color: colors.textSecondary }]}>
              These students have been absent 3 or more times. Tap 🗑 to dismiss warning.
            </Text>
            {visibleAbsentees.length > 0 ? (
              <FrequentAbsenteesList
                students={visibleAbsentees}
                onDismiss={handleDismissAbsentee}
              />
            ) : (
              <View style={[styles.emptyAbsenteeBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyAbsenteeText, { color: colors.textSecondary }]}>
                  No students flagged with 3+ absences.
                </Text>
              </View>
            )}

            <Text style={[styles.sectionTitleLabel, { color: colors.text, marginTop: 16 }]}>
              Student Attendance Roster
            </Text>
            <StudentAnalyticsList students={studentAnalytics} />

            <Text style={[styles.sectionTitleLabel, { color: colors.text, marginTop: 16 }]}>
              History By Date
            </Text>
            <AttendanceHistoryByDateList history={historyByDate} onDelete={handleDeleteHistoryByDate} />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 4. My Students Tab Screen
// ---------------------------------------------------------------------
function MyStudentsTabScreen({ user, colors }: { user: any; colors: any }) {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [interviewHistory, setInterviewHistory] = useState<any[]>([]);
  const [progressReports, setProgressReports] = useState<any[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportNotes, setReportNotes] = useState('');
  const [improvementPct, setImprovementPct] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const fetchStudents = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await teacherService.getAssignedStudents(user.id);
      setStudents(data);
    } catch (err) {
      console.error('Failed to load assigned students:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchStudents(); }, [fetchStudents]));

  const openStudentProfile = async (student: any) => {
    setSelectedStudent(student);
    setLoadingProfile(true);
    try {
      const [history, reports] = await Promise.all([
        teacherService.getStudentInterviewHistory(student.id),
        teacherService.getStudentProgressReports(student.id),
      ]);
      setInterviewHistory(history);
      setProgressReports(reports);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedStudent || !user?.id) return;
    const pct = parseFloat(improvementPct);
    if (!reportNotes.trim()) {
      Alert.alert('Validation', 'Please add progress notes.');
      return;
    }
    if (isNaN(pct)) {
      Alert.alert('Validation', 'Please enter a valid improvement percentage.');
      return;
    }
    try {
      setIsSubmitting(true);
      await teacherService.submitProgressReport({
        studentId: selectedStudent.id,
        teacherId: user.id,
        progressNotes: reportNotes.trim(),
        improvementPercentage: pct,
      });
      Alert.alert('Success', 'Progress report submitted successfully.');
      setShowReportModal(false);
      setReportNotes('');
      setImprovementPct('');
      // Refresh reports
      const reports = await teacherService.getStudentProgressReports(selectedStudent.id);
      setProgressReports(reports);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLevelColor = (level: string | null | undefined) => {
    switch (level) {
      case 'Advanced': return colors.success;
      case 'Intermediate': return colors.warning;
      case 'Elementary': return '#f59e0b';
      default: return colors.danger;
    }
  };

  // PROFILE VIEW
  if (selectedStudent) {
    return (
      <ScreenContainer>
        <ScrollView
          style={[styles.scrollContainer, { backgroundColor: colors.background }]}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={[msStyles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setSelectedStudent(null)}
          >
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={[msStyles.backBtnText, { color: colors.primary }]}>All Students</Text>
          </TouchableOpacity>

          {/* Student Header */}
          <View style={[msStyles.profileHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[msStyles.profileAvatar, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[msStyles.profileAvatarText, { color: colors.primary }]}>
                {selectedStudent.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[msStyles.profileName, { color: colors.text }]}>{selectedStudent.name}</Text>
            <Text style={[msStyles.profileEmail, { color: colors.textSecondary }]}>{selectedStudent.email}</Text>
            <View style={styles.statsCardGrid}>
              {selectedStudent.level && (
                <View style={[msStyles.pill, { backgroundColor: getLevelColor(selectedStudent.level) + '20' }]}>
                  <Text style={[msStyles.pillText, { color: getLevelColor(selectedStudent.level) }]}>
                    {selectedStudent.level}
                  </Text>
                </View>
              )}
              {selectedStudent.class && (
                <View style={[msStyles.pill, { backgroundColor: colors.secondary + '20' }]}>
                  <Text style={[msStyles.pillText, { color: colors.secondary }]}>Class {selectedStudent.class}</Text>
                </View>
              )}
              {selectedStudent.section && (
                <View style={[msStyles.pill, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[msStyles.pillText, { color: colors.primary }]}>Sec. {selectedStudent.section}</Text>
                </View>
              )}
            </View>
          </View>

          {loadingProfile ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
          ) : (
            <>
              {/* Interview History */}
              <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary, marginTop: 20 }]}>
                Interview History ({interviewHistory.length})
              </Text>
              {interviewHistory.length === 0 ? (
                <View style={[msStyles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No interviews on record.</Text>
                </View>
              ) : (
                interviewHistory.map((iv, idx) => (
                  <View key={iv.id} style={[msStyles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={msStyles.historyCardHeader}>
                      <View style={[msStyles.historyBadge, {
                        backgroundColor: iv.interview_type === 'admission' ? colors.primary + '15' : colors.warning + '15'
                      }]}>
                        <Text style={[msStyles.historyBadgeText, {
                          color: iv.interview_type === 'admission' ? colors.primary : colors.warning
                        }]}>
                          {iv.interview_type === 'admission' ? 'Admission' : '14-Day Review'}
                        </Text>
                      </View>
                      <Text style={[msStyles.historyDate, { color: colors.textSecondary }]}>
                        {new Date(iv.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    <View style={msStyles.historyScoreRow}>
                      <Text style={[msStyles.historyScore, { color: colors.text }]}>Total Score: {iv.total_score}/50</Text>
                      {iv.assigned_level && (
                        <View style={[msStyles.pill, { backgroundColor: getLevelColor(iv.assigned_level) + '20' }]}>
                          <Text style={[msStyles.pillText, { color: getLevelColor(iv.assigned_level) }]}>{iv.assigned_level}</Text>
                        </View>
                      )}
                    </View>

                    {/* Detailed Scores Section */}
                    <View style={{ marginTop: 8, gap: 4 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                        Sub-Scores: Eng {iv.english} | Comm {iv.communication} | Conf {iv.confidence} | Tech {iv.technical_skills} | Learn {iv.learning_ability}
                      </Text>
                      
                      {iv.strengths && (
                        <Text style={{ fontSize: 12, color: colors.text, marginTop: 4 }}>
                          <Text style={{ fontWeight: '700', color: colors.success }}>Strengths: </Text>{iv.strengths}
                        </Text>
                      )}
                      
                      {iv.weaknesses && (
                        <Text style={{ fontSize: 12, color: colors.text }}>
                          <Text style={{ fontWeight: '700', color: colors.danger }}>Weaknesses: </Text>{iv.weaknesses}
                        </Text>
                      )}

                      {iv.recommendations && (
                        <Text style={{ fontSize: 12, color: colors.text, fontStyle: 'italic' }}>
                          <Text style={{ fontWeight: '700', fontStyle: 'normal', color: colors.primary }}>ASR Recommendations: </Text>{iv.recommendations}
                        </Text>
                      )}
                    </View>

                    {iv.notes && (
                      <Text style={[msStyles.historyNotes, { color: colors.textSecondary, marginTop: 8 }]} numberOfLines={3}>
                        {iv.notes}
                      </Text>
                    )}
                  </View>
                ))
              )}

              {/* Progress Reports */}
              <View style={msStyles.sectionHeaderRow}>
                <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary, marginTop: 20, marginBottom: 0 }]}>
                  Progress Reports ({progressReports.length})
                </Text>
                <TouchableOpacity
                  style={[msStyles.addReportBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setShowReportModal(true)}
                >
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text style={msStyles.addReportBtnText}>Add Report</Text>
                </TouchableOpacity>
              </View>

              {progressReports.length === 0 ? (
                <View style={[msStyles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No progress reports submitted yet.</Text>
                </View>
              ) : (
                progressReports.map((rpt) => (
                  <View key={rpt.id} style={[msStyles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={msStyles.historyCardHeader}>
                      <Text style={[msStyles.historyDate, { color: colors.textSecondary }]}>
                        {new Date(rpt.created_at).toLocaleDateString()}
                      </Text>
                      <View style={[msStyles.pill, { backgroundColor: colors.success + '20' }]}>
                        <Text style={[msStyles.pillText, { color: colors.success }]}>
                          +{rpt.improvement_percentage}%
                        </Text>
                      </View>
                    </View>
                    <Text style={[msStyles.historyNotes, { color: colors.text }]}>{rpt.progress_notes}</Text>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>

        {/* Progress Report Modal */}
        <Modal visible={showReportModal} animationType="slide" transparent>
          <View style={msStyles.modalOverlay}>
            <View style={[msStyles.modalContent, { backgroundColor: colors.background }]}>
              <View style={[msStyles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[msStyles.modalTitle, { color: colors.text }]}>Submit Progress Report</Text>
                <TouchableOpacity onPress={() => setShowReportModal(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Text style={[msStyles.fieldLabel, { color: colors.textSecondary }]}>Progress Notes</Text>
                <TextInput
                  style={[msStyles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder="Describe the student's progress, strengths and areas to improve..."
                  placeholderTextColor={colors.textSecondary}
                  value={reportNotes}
                  onChangeText={setReportNotes}
                  multiline
                  numberOfLines={5}
                />
                <Text style={[msStyles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>Improvement % (0–100)</Text>
                <TextInput
                  style={[msStyles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g. 15"
                  placeholderTextColor={colors.textSecondary}
                  value={improvementPct}
                  onChangeText={setImprovementPct}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[msStyles.submitBtn, { backgroundColor: isSubmitting ? colors.border : colors.primary }]}
                  onPress={handleSubmitReport}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={msStyles.submitBtnText}>Submit Report</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScreenContainer>
    );
  }

  // LIST VIEW
  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStudents(); }} tintColor={colors.primary} />}
      >
        <View style={styles.tabHeader}>
          <Text style={[styles.tabTitle, { color: colors.text }]}>My Students</Text>
          <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
            Students assigned to you — tap to view their profile
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : students.length === 0 ? (
          <View style={[styles.emptyStateContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Students Assigned</Text>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Contact admin to assign students to your account.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {students.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[msStyles.studentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => openStudentProfile(s)}
                activeOpacity={0.8}
              >
                <View style={[msStyles.studentAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[msStyles.studentAvatarText, { color: colors.primary }]}>
                    {s.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[msStyles.studentName, { color: colors.text }]}>{s.name}</Text>
                  <Text style={[msStyles.studentEmail, { color: colors.textSecondary }]}>{s.email}</Text>
                  <View style={msStyles.pillRow}>
                    {s.level && (
                      <View style={[msStyles.pill, { backgroundColor: getLevelColor(s.level) + '20' }]}>
                        <Text style={[msStyles.pillText, { color: getLevelColor(s.level) }]}>{s.level}</Text>
                      </View>
                    )}
                    {s.class && (
                      <View style={[msStyles.pill, { backgroundColor: colors.secondary + '20' }]}>
                        <Text style={[msStyles.pillText, { color: colors.secondary }]}>Cl. {s.class}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 5. Profile Tab Screen
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
              {user?.name ? user.name.charAt(0).toUpperCase() : 'T'}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          <View style={[styles.roleLabel, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.roleLabelText, { color: colors.primary }]}>TEACHER</Text>
          </View>
        </View>

        {/* Settings Info Groups */}
        <Text style={[styles.profileGroupTitle, { color: colors.textSecondary }]}>Academic Details</Text>
        <View style={[styles.profileGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.profileRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>Registration Status</Text>
            <View style={[styles.badge, { backgroundColor: colors.success + '15', position: 'relative', top: 0, right: 0 }]}>
              <Text style={[styles.badgeText, { color: colors.success, fontSize: 11, fontWeight: '700' }]}>Approved</Text>
            </View>
          </View>
          <View style={[styles.profileRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>Primary School Email</Text>
            <Text style={[styles.profileRowVal, { color: colors.text }]} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>Academic Role</Text>
            <Text style={[styles.profileRowVal, { color: colors.text }]}>Course Instructor</Text>
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
export default function TeacherDashboardScreen() {
  const { user, signOut, isInitializing: authLoading } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({ students: 0, courses: 0, notifications: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!user?.id) return;
      
      const [coursesData, statsData] = await Promise.all([
        teacherService.getCourses(user.id),
        dashboardService.getTeacherStats(user.id)
      ]);
      
      setCourses(coursesData);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchData();
      }
    }, [user?.id, fetchData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
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
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Attendance') {
            iconName = focused ? 'checkbox' : 'checkbox-outline';
          } else if (route.name === 'Analytics') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'My Students') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return (
            <View style={styles.tabIconBg}>
              <Ionicons name={iconName} size={24} color={color} />
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
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 15,
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
            courses={courses}
            isLoading={isLoading}
            refreshing={refreshing}
            onRefresh={onRefresh}
            router={router}
            colors={colors}
            isDark={isDark}
            toggleTheme={toggleTheme}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Attendance">
        {() => (
          <AttendanceTabScreen
            courses={courses}
            isLoading={isLoading}
            refreshing={refreshing}
            onRefresh={onRefresh}
            handleNavigateToCourse={handleNavigateToCourse}
            colors={colors}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Analytics">
        {() => (
          <AnalyticsTabScreen
            user={user}
            colors={colors}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="My Students">
        {() => (
          <MyStudentsTabScreen
            user={user}
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
    marginBottom: 10,
  },
  statsCardGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statsGridItem: {
    flex: 1,
    borderRadius: 18,
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
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
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
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 20,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  courseQuickMarkList: {
    gap: 10,
  },
  quickMarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  quickMarkInfo: {
    flex: 1,
    paddingRight: 12,
  },
  quickMarkTitle: {
    fontSize: 18,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  quickMarkCode: {
    fontSize: 12,
    marginTop: 4,
  },
  quickMarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  quickMarkBtnText: {
    fontSize: 18,
    fontWeight: '500',
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

  // Analytics transplanted styles
  coursePicker: {
    marginBottom: 10,
    maxHeight: 44,
  },
  courseChip: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  courseChipText: {
    fontSize: 20,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  rateRow: {
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  frequentHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  frequentSubtitle: {
    fontSize: 10,
    marginBottom: 4,
  },
  emptyAbsenteeBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyAbsenteeText: {
    fontSize: 13,
    fontWeight: '500',
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
});

// Separate stylesheet for MyStudents components
const msStyles = StyleSheet.create({
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 12, borderWidth: 1,
    marginBottom: 16, alignSelf: 'flex-start',
  },
  backBtnText: { fontSize: 13, fontWeight: '600' },
  profileHeader: {
    borderRadius: 20, borderWidth: 1, padding: 20,
    alignItems: 'center', gap: 6,
  },
  profileAvatar: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  profileAvatarText: { fontSize: 28, fontWeight: '800' },
  profileName: { fontSize: 18, fontWeight: '700' },
  profileEmail: { fontSize: 13, marginBottom: 8 },
  pill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  pillText: { fontSize: 11, fontWeight: '600' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  emptyBox: {
    padding: 20, borderRadius: 14, borderWidth: 1,
    alignItems: 'center',
  },
  historyCard: {
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  historyCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  historyBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  historyBadgeText: { fontSize: 11, fontWeight: '700' },
  historyDate: { fontSize: 11 },
  historyScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  historyScore: { fontSize: 14, fontWeight: '700' },
  historyNotes: { fontSize: 13, lineHeight: 18 },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  addReportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
  },
  addReportBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  studentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  studentAvatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  studentAvatarText: { fontSize: 20, fontWeight: '700' },
  studentName: { fontSize: 15, fontWeight: '700' },
  studentEmail: { fontSize: 12, marginTop: 1 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  textArea: {
    borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14,
    minHeight: 100, textAlignVertical: 'top',
  },
  textInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
  },
  submitBtn: {
    marginTop: 20, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
