import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Button } from '../../component/common/Button';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { admissionService } from '../../services/admissionService';
import { interviewerService } from '../../services/interviewerService';
import { Interview, Profile, StudentProgressReview } from '../../types';
import { supabase } from '../../utils/supabase';

const Tab = createBottomTabNavigator();

// Score option pill buttons (0 to 10)
const SCORE_OPTIONS = Array.from({ length: 11 }, (_, i) => i);

// ---------------------------------------------------------------------
// 1. Home Tab Screen
// ---------------------------------------------------------------------
interface HomeTabProps {
  user: any;
  colors: any;
  isDark: boolean;
  toggleTheme: () => void;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  newStudents: Profile[];
  pendingReviews: StudentProgressReview[];
  onOpenInterview: (student: Profile) => void;
  onOpenReview: (review: StudentProgressReview) => void;
}

function HomeTabScreen({
  user,
  colors,
  isDark,
  toggleTheme,
  refreshing,
  onRefresh,
  newStudents,
  pendingReviews,
  onOpenInterview,
  onOpenReview,
}: HomeTabProps) {
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
            <View style={[styles.avatarCircle, { backgroundColor: colors.success }]}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'I'}
              </Text>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {user?.name || 'Interviewer'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.roleBadge, { backgroundColor: colors.success + '15' }]}>
              <Text style={[styles.roleBadgeText, { color: colors.success }]}>ASR</Text>
            </View>
          </View>
        </View>

        {/* Overview Stats */}
        <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary }]}>Overview</Text>
        <View style={styles.statsCardGrid}>
          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="person-add" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.text }]}>{newStudents?.length || 0}</Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>New Admissions</Text>
          </View>

          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.warning + '15' }]}>
              <Ionicons name="time" size={22} color={colors.warning} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.text }]}>{pendingReviews?.length || 0}</Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>14-Day Reviews</Text>
          </View>
        </View>

        {/* Section: New Admissions */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionTitleHeader, { color: colors.text }]}>Pending Admission Interviews</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Newly registered students waiting for assessment
          </Text>
        </View>

        {!newStudents || newStudents.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyCardText, { color: colors.textSecondary }]}>
              No new registered students waiting for interviews.
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {newStudents.map((student) => (
              <View
                key={student.id}
                style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.cardMain}>
                  <View style={[styles.initialCircle, { backgroundColor: colors.secondary + '15' }]}>
                    <Text style={[styles.initialText, { color: colors.secondary }]}>
                      {student?.name ? student.name.charAt(0).toUpperCase() : '?'}
                    </Text>
                  </View>
                  <View style={styles.cardDetails}>
                    <Text style={[styles.studentName, { color: colors.text }]}>{student?.name || 'Unknown Student'}</Text>
                    <Text style={[styles.studentEmail, { color: colors.textSecondary }]}>{student?.email || 'N/A'}</Text>
                    <Text style={{ fontSize: 11.5, color: colors.primary, marginTop: 4, fontWeight: '600' }}>
                      Course: {(student as any).course_name || 'N/A'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                      Status: {(student as any).interview_status || 'Pending'} | Date: {(student as any).created_at ? new Date((student as any).created_at).toLocaleDateString() : 'N/A'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.conductButton, { backgroundColor: colors.primary }]}
                  onPress={() => onOpenInterview(student)}
                >
                  <Ionicons name="clipboard-outline" size={14} color={colors.white} style={{ marginRight: 4 }} />
                  <Text style={[styles.conductButtonText, { color: colors.white }]}>Assess</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Section: Pending 14-Day Reviews */}
        <View style={[styles.sectionHeaderContainer, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitleHeader, { color: colors.text }]}>Pending 14-Day Reviews</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Students scheduled for post-admission check-in
          </Text>
        </View>

        {!pendingReviews || pendingReviews.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyCardText, { color: colors.textSecondary }]}>
              No pending student progress reviews.
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {pendingReviews.map((review) => (
              <View
                key={review.id}
                style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.cardMain}>
                  <View style={[styles.initialCircle, { backgroundColor: colors.warning + '15' }]}>
                    <Text style={[styles.initialText, { color: colors.warning }]}>
                      {review.student_name ? review.student_name.charAt(0).toUpperCase() : 'S'}
                    </Text>
                  </View>
                  <View style={styles.cardDetails}>
                    <Text style={[styles.studentName, { color: colors.text }]}>{review.student_name || 'Unknown Student'}</Text>
                    <Text style={[styles.studentEmail, { color: colors.textSecondary }]}>
                      Due: {review.scheduled_date ? new Date(review.scheduled_date).toLocaleDateString() : 'N/A'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.conductButton, { backgroundColor: colors.warning }]}
                  onPress={() => onOpenReview(review)}
                >
                  <Ionicons name="analytics-outline" size={14} color={colors.white} style={{ marginRight: 4 }} />
                  <Text style={[styles.conductButtonText, { color: colors.white }]}>Review</Text>
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
// 2. History Tab Screen
// ---------------------------------------------------------------------
interface HistoryTabProps {
  colors: any;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  interviewsHistory: Interview[];
  onViewDetails: (interview: Interview) => void;
}

function HistoryTabScreen({
  colors,
  refreshing,
  onRefresh,
  interviewsHistory,
  onViewDetails,
}: HistoryTabProps) {
  const [historySegment, setHistorySegment] = useState<'all' | 'admissions' | 'reviews'>('all');

  const filteredHistory = interviewsHistory.filter((item) => {
    if (historySegment === 'all') return true;
    if (historySegment === 'admissions') return item.interview_type === 'admission';
    if (historySegment === 'reviews') return item.interview_type === 'progress_review';
    return true;
  });

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
          <Text style={[styles.tabTitle, { color: colors.text }]}>Assessment History</Text>
          <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
            History of conducted admissions and progress reviews
          </Text>
        </View>

        {/* Segmented Control */}
        <View style={[styles.segmentContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.segmentButton, historySegment === 'all' && { backgroundColor: colors.success }]}
            onPress={() => setHistorySegment('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentText, { color: historySegment === 'all' ? colors.white : colors.textSecondary }]}>
              All ({interviewsHistory.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, historySegment === 'admissions' && { backgroundColor: colors.success }]}
            onPress={() => setHistorySegment('admissions')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentText, { color: historySegment === 'admissions' ? colors.white : colors.textSecondary }]}>
              Admissions ({interviewsHistory.filter(i => i.interview_type === 'admission').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, historySegment === 'reviews' && { backgroundColor: colors.success }]}
            onPress={() => setHistorySegment('reviews')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentText, { color: historySegment === 'reviews' ? colors.white : colors.textSecondary }]}>
              Reviews ({interviewsHistory.filter(i => i.interview_type === 'progress_review').length})
            </Text>
          </TouchableOpacity>
        </View>

        {filteredHistory.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 60 }]}>
            <Ionicons name="document-text-outline" size={50} color={colors.textSecondary} />
            <Text style={[styles.emptyCardText, { color: colors.textSecondary, marginTop: 12 }]}>
              No interviews completed yet.
            </Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {filteredHistory.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => onViewDetails(item)}
                activeOpacity={0.7}
              >
                <View style={styles.historyCardHeader}>
                  <View style={styles.historyTypeBadgeContainer}>
                    <View style={[
                      styles.typeBadge,
                      { backgroundColor: item.interview_type === 'admission' ? colors.primary + '15' : colors.warning + '15' }
                    ]}>
                      <Text style={[
                        styles.typeBadgeText,
                        { color: item.interview_type === 'admission' ? colors.primary : colors.warning }
                      ]}>
                        {item.interview_type === 'admission' ? 'Admission' : '14-Day Review'}
                      </Text>
                    </View>
                    <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[
                    styles.levelBadge,
                    { 
                      backgroundColor: 
                        item.assigned_level === 'Advanced' ? colors.success + '15' : 
                        item.assigned_level === 'Intermediate' ? colors.secondary + '15' : 
                        item.assigned_level === 'Elementary' ? colors.primary + '15' : 
                        colors.danger + '15' 
                    }
                  ]}>
                    <Text style={[
                      styles.levelBadgeText,
                      { 
                        color: 
                          item.assigned_level === 'Advanced' ? colors.success : 
                          item.assigned_level === 'Intermediate' ? colors.secondary : 
                          item.assigned_level === 'Elementary' ? colors.primary : 
                          colors.danger 
                      }
                    ]}>
                      {item.assigned_level}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.historyStudentName, { color: colors.text }]}>
                  {item.student_name || 'Student'}
                </Text>

                <View style={styles.historyScoresSummary}>
                  <Text style={[styles.scoreSummaryText, { color: colors.textSecondary }]}>
                    Total Score: <Text style={{ color: colors.text, fontWeight: '700' }}>{item.total_score}/50</Text>
                  </Text>
                  <Text style={[styles.scoreSummaryText, { color: colors.textSecondary }]} numberOfLines={1}>
                    Rec: {item.recommendations || 'None'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 3. Profile Tab Screen
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
          <View style={[styles.profileAvatar, { backgroundColor: colors.success }]}>
            <Text style={styles.profileAvatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'I'}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          <View style={[styles.roleLabel, { backgroundColor: colors.success + '15' }]}>
            <Text style={[styles.roleLabelText, { color: colors.success }]}>ASR</Text>
          </View>
        </View>

        {/* Settings Info Groups */}
        <Text style={[styles.profileGroupTitle, { color: colors.textSecondary }]}>Details</Text>
        <View style={[styles.profileGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.profileRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>Registration Status</Text>
            <View style={[styles.badge, { backgroundColor: colors.success + '15', position: 'relative', top: 0, right: 0 }]}>
              <Text style={[styles.badgeText, { color: colors.success, fontSize: 11, fontWeight: '700' }]}>Approved</Text>
            </View>
          </View>
          <View style={[styles.profileRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>School Email</Text>
            <Text style={[styles.profileRowVal, { color: colors.text }]} numberOfLines={1}>
              {user?.email}
            </Text>
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
export default function InterviewerDashboardScreen() {
  const { user, signOut, isInitializing: authLoading } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();

  // State
  const [newStudents, setNewStudents] = useState<Profile[]>([]);
  const [pendingReviews, setPendingReviews] = useState<StudentProgressReview[]>([]);
  const [interviewsHistory, setInterviewsHistory] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State for Admission Interview
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [english, setEnglish] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [technical, setTechnical] = useState(0);
  const [learning, setLearning] = useState(0);
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal State for Progress Review
  const [selectedReview, setSelectedReview] = useState<StudentProgressReview | null>(null);
  const [prevInterview, setPrevInterview] = useState<Interview | null>(null);

  // Detail Modal State
  const [viewingInterview, setViewingInterview] = useState<Interview | null>(null);

  // Recommended course & teacher selection state
  const [courses, setCourses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [recommendedCourseId, setRecommendedCourseId] = useState<string | null>(null);
  const [recommendedTeacherId, setRecommendedTeacherId] = useState<string | null>(null);

  useEffect(() => {
    const loadCoursesAndTeachers = async () => {
      try {
        const { data: coursesData } = await supabase.from('courses').select('id, name, code');
        const { data: teachersData } = await supabase.from('profiles').select('id, name').eq('role', 'teacher').eq('approved', true);
        if (coursesData) setCourses(coursesData);
        if (teachersData) setTeachers(teachersData);
      } catch (err) {
        console.warn('Failed to load courses or teachers:', err);
      }
    };
    loadCoursesAndTeachers();
  }, []);

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
      // Auto-trigger due reviews notifications check in background
      admissionService.triggerForthnightNotifications().catch(err => {
        console.warn('Failed to auto-trigger fortnight notifications:', err);
      });

      const [newStuds, reviews] = await Promise.all([
        interviewerService.getNewStudents(),
        interviewerService.getPendingProgressReviews(),
      ]);
      setNewStudents(Array.isArray(newStuds) ? newStuds : []);
      setPendingReviews(Array.isArray(reviews) ? reviews : []);

      console.log("Interviewer dashboard stats:", {
        newStudentsCount: Array.isArray(newStuds) ? newStuds.length : 0,
        pendingReviewsCount: Array.isArray(reviews) ? reviews.length : 0
      });

      // Fetch history for the interviewer
      if (user?.id) {
        const { data, error } = await supabase
          .from('interviews')
          .select('*, profiles!student_id(name)')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Error fetching interview history:', error.message);
        } else if (data) {
          setInterviewsHistory(
            data.map((row: any) => ({
              ...row,
              student_name: row.profiles?.name || row.student_name || 'Unknown Student',
            }))
          );
        }
      }
    } catch (err: any) {
      // Enhanced logging to avoid "NamelessError" and provide better diagnostics
      const errorPayload = {
        message: err?.message || 'Unknown error',
        details: err?.details || 'No details',
        hint: err?.hint || 'No hint',
        code: err?.code || 'No code',
        stack: err?.stack || 'No stack'
      };
      console.error('Failed to fetch interviewer dashboard data:', JSON.stringify(errorPayload, null, 2));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const resetForm = () => {
    setEnglish(0);
    setCommunication(0);
    setConfidence(0);
    setTechnical(0);
    setLearning(0);
    setStrengths('');
    setWeaknesses('');
    setRecommendations('');
    setSelectedStudent(null);
    setSelectedReview(null);
    setPrevInterview(null);
    setRecommendedCourseId(null);
    setRecommendedTeacherId(null);
  };

  const handleOpenInterview = (student: Profile) => {
    resetForm();
    setSelectedStudent(student);
  };

  const handleOpenReview = async (review: StudentProgressReview) => {
    resetForm();
    setSelectedReview(review);
    try {
      const studentInts = await interviewerService.getStudentInterviews(review.student_id);
      const admissionInt = studentInts.find(i => i.interview_type === 'admission');
      if (admissionInt) {
        setPrevInterview(admissionInt);
      }
    } catch (err) {
      console.warn('Failed to load student admission score:', err);
    }
  };

  const handleSubmitInterview = async () => {
    if (!selectedStudent || !user?.id) return;

    // Validation for Course and Teacher assignment
    if (!recommendedCourseId) {
      Alert.alert('Validation Error', 'Please assign a recommended Course before submitting.');
      return;
    }
    if (!recommendedTeacherId) {
      Alert.alert('Validation Error', 'Please assign a recommended Teacher before submitting.');
      return;
    }

    try {
      setSubmitting(true);

      let studentId = selectedStudent.id;

      // If this is a placeholder from an orphan deal, we must resolve/create the student profile first
      if ((selectedStudent as any).is_placeholder) {
        console.log("[dashboard] Resolving placeholder student for assessment...");
        const { data: newId, error: rpcErr } = await supabase.rpc('create_student_from_admission', {
          p_email: selectedStudent.email,
          p_name: selectedStudent.name,
          p_father_name: (selectedStudent as any).father_name || '',
          p_phone: (selectedStudent as any).phone_number || '',
          p_whatsapp: (selectedStudent as any).whatsapp_number || '',
          p_course_id: (selectedStudent as any).course_id || null,
          p_class: (selectedStudent as any).class || '',
          p_teacher_id: (selectedStudent as any).teacher_id || null,
          p_deal_id: selectedStudent.id, // The placeholder ID is the deal ID
        });

        if (rpcErr) {
          throw new Error('Failed to create student profile for this assessment: ' + rpcErr.message);
        }
        if (newId) {
          studentId = newId;
          console.log("[dashboard] Placeholder resolved to student_id:", studentId);
        }
      }

      const totalScore = english + communication + confidence + technical + learning;
      let assignedLevel: 'Beginner' | 'Elementary' | 'Intermediate' | 'Advanced' = 'Beginner';
      if (totalScore >= 40) assignedLevel = 'Advanced';
      else if (totalScore >= 25) assignedLevel = 'Intermediate';
      else if (totalScore >= 10) assignedLevel = 'Elementary';

      await admissionService.submitInterviewForReview({
        studentId: studentId,
        interviewerId: user.id,
        english,
        communication,
        confidence,
        technicalSkills: technical,
        learningAbility: learning,
        assignedLevel,
        notes: `Admission Interview & Academic Placement completed. Scores: Eng ${english}, Comm ${communication}, Conf ${confidence}, Tech ${technical}, Learn ${learning}.`,
        strengths: strengths.trim(),
        weaknesses: weaknesses.trim(),
        recommendations: recommendations.trim(),
        recommendedCourseId: recommendedCourseId || null,
        recommendedTeacherId: recommendedTeacherId || null,
      });

      Alert.alert('Success', 'Admission assessment and academic placement submitted successfully!');
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error("[dashboard] Error in handleSubmitInterview:", err);
      Alert.alert('Error', err.message || 'Failed to submit interview');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedReview || !user?.id) return;
    try {
      setSubmitting(true);

      const totalScore = english + communication + confidence + technical + learning;
      let assignedLevel: 'Beginner' | 'Elementary' | 'Intermediate' | 'Advanced' = 'Beginner';
      if (totalScore >= 40) assignedLevel = 'Advanced';
      else if (totalScore >= 25) assignedLevel = 'Intermediate';
      else if (totalScore >= 10) assignedLevel = 'Elementary';

      await interviewerService.completeProgressReview({
        reviewId: selectedReview.id,
        interviewerId: user.id,
        english,
        communication,
        confidence,
        technicalSkills: technical,
        learningAbility: learning,
        assignedLevel,
        notes: `14-Day Progress Review completed. Scores: Eng ${english}, Comm ${communication}, Conf ${confidence}, Tech ${technical}, Learn ${learning}.`,
        strengths: strengths.trim(),
        weaknesses: weaknesses.trim(),
        recommendations: recommendations.trim(),
      });

      Alert.alert('Success', '14-Day progress review completed successfully!');
      resetForm();
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to complete review');
    } finally {
      setSubmitting(false);
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

  const calculatedTotal = english + communication + confidence + technical + learning;
  const calculatedLevel = calculatedTotal >= 40 ? 'Advanced' : calculatedTotal >= 25 ? 'Intermediate' : calculatedTotal >= 10 ? 'Elementary' : 'Beginner';

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size, focused }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'History') {
              iconName = focused ? 'document-text' : 'document-text-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            }
            return (
              <View style={styles.tabIconBg}>
                <Ionicons name={iconName} size={24} color={color} />
              </View>
            );
          },
          tabBarActiveTintColor: colors.success,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 0,
            height: 98,
            paddingBottom: 10,
            paddingTop: 8,
            elevation: 12,
            shadowColor: colors.success,
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
              colors={colors}
              isDark={isDark}
              toggleTheme={toggleTheme}
              refreshing={refreshing}
              onRefresh={onRefresh}
              newStudents={newStudents}
              pendingReviews={pendingReviews}
              onOpenInterview={handleOpenInterview}
              onOpenReview={handleOpenReview}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="History">
          {() => (
            <HistoryTabScreen
              colors={colors}
              refreshing={refreshing}
              onRefresh={onRefresh}
              interviewsHistory={interviewsHistory}
              onViewDetails={setViewingInterview}
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

      {/* ADMISSION INTERVIEW MODAL */}
      <Modal visible={selectedStudent !== null} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Admission Interview</Text>
                <Text style={[styles.modalStudentSub, { color: colors.textSecondary }]}>
                  Candidate: {selectedStudent?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={resetForm}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              {/* Category: English */}
              <View style={styles.scoreRowContainer}>
                <Text style={[styles.scoreLabel, { color: colors.text }]}>English Vocabulary & Grammar</Text>
                <View style={styles.scorePills}>
                  {SCORE_OPTIONS.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scorePill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        english === num && { backgroundColor: colors.success, borderColor: colors.success },
                      ]}
                      onPress={() => setEnglish(num)}
                    >
                      <Text style={[styles.scorePillText, { color: colors.text }, english === num && { color: colors.white }]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category: Communication */}
              <View style={styles.scoreRowContainer}>
                <Text style={[styles.scoreLabel, { color: colors.text }]}>Communication Skills</Text>
                <View style={styles.scorePills}>
                  {SCORE_OPTIONS.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scorePill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        communication === num && { backgroundColor: colors.success, borderColor: colors.success },
                      ]}
                      onPress={() => setCommunication(num)}
                    >
                      <Text style={[styles.scorePillText, { color: colors.text }, communication === num && { color: colors.white }]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category: Confidence */}
              <View style={styles.scoreRowContainer}>
                <Text style={[styles.scoreLabel, { color: colors.text }]}>Confidence Level</Text>
                <View style={styles.scorePills}>
                  {SCORE_OPTIONS.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scorePill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        confidence === num && { backgroundColor: colors.success, borderColor: colors.success },
                      ]}
                      onPress={() => setConfidence(num)}
                    >
                      <Text style={[styles.scorePillText, { color: colors.text }, confidence === num && { color: colors.white }]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category: Technical */}
              <View style={styles.scoreRowContainer}>
                <Text style={[styles.scoreLabel, { color: colors.text }]}>Technical Skills & Aptitude</Text>
                <View style={styles.scorePills}>
                  {SCORE_OPTIONS.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scorePill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        technical === num && { backgroundColor: colors.success, borderColor: colors.success },
                      ]}
                      onPress={() => setTechnical(num)}
                    >
                      <Text style={[styles.scorePillText, { color: colors.text }, technical === num && { color: colors.white }]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category: Learning */}
              <View style={styles.scoreRowContainer}>
                <Text style={[styles.scoreLabel, { color: colors.text }]}>Learning Ability</Text>
                <View style={styles.scorePills}>
                  {SCORE_OPTIONS.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scorePill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        learning === num && { backgroundColor: colors.success, borderColor: colors.success },
                      ]}
                      onPress={() => setLearning(num)}
                    >
                      <Text style={[styles.scorePillText, { color: colors.text }, learning === num && { color: colors.white }]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Real-time Calculation summary */}
              <View style={[styles.calcCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>Calculated Total Score:</Text>
                  <Text style={[styles.calcValue, { color: colors.text }]}>{calculatedTotal} / 50</Text>
                </View>
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>Assigned Level:</Text>
                  <View style={[
                    styles.levelBadgeInline,
                    { backgroundColor: calculatedLevel === 'Advanced' ? colors.success + '15' : calculatedLevel === 'Intermediate' ? colors.secondary + '15' : colors.danger + '15' }
                  ]}>
                    <Text style={[
                      styles.levelBadgeTextInline,
                      { color: calculatedLevel === 'Advanced' ? colors.success : calculatedLevel === 'Intermediate' ? colors.secondary : colors.danger }
                    ]}>
                      {calculatedLevel}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Strengths Input */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Strengths</Text>
              <TextInput
                style={[styles.textArea, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
                multiline
                placeholder="What did the candidate excel at?"
                placeholderTextColor={colors.textSecondary}
                value={strengths}
                onChangeText={setStrengths}
              />

              {/* Weaknesses Input */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Weaknesses</Text>
              <TextInput
                style={[styles.textArea, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
                multiline
                placeholder="Where does the candidate need improvement?"
                placeholderTextColor={colors.textSecondary}
                value={weaknesses}
                onChangeText={setWeaknesses}
              />

              {/* Recommendations Input */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Recommendations / Notes</Text>
              <TextInput
                style={[styles.textArea, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
                multiline
                placeholder="Enter final recommendation notes..."
                placeholderTextColor={colors.textSecondary}
                value={recommendations}
                onChangeText={setRecommendations}
              />

              {/* Assigned Course Selection */}
              <Text style={[styles.inputLabel, { color: colors.text, marginTop: 8 }]}>Assigned Course</Text>
              <View style={[styles.teacherPickerContainer, { borderColor: colors.border, marginTop: 4 }]}>
                {courses.length === 0 ? (
                  <Text style={{ color: colors.textSecondary, padding: 12 }}>No courses available.</Text>
                ) : (
                  courses.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.teacherPickerItem,
                        { borderColor: colors.border },
                        recommendedCourseId === c.id && { backgroundColor: colors.success + '15', borderColor: colors.success },
                      ]}
                      onPress={() => setRecommendedCourseId(c.id)}
                    >
                      <View style={[styles.teacherPickerDot, { backgroundColor: recommendedCourseId === c.id ? colors.success : colors.border }]} />
                      <Text style={[styles.teacherPickerName, { color: colors.text }]}>{c.name} ({c.code})</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              {/* Assigned Teacher Selection */}
              <Text style={[styles.inputLabel, { color: colors.text, marginTop: 8 }]}>Assigned Class/Teacher</Text>
              <View style={[styles.teacherPickerContainer, { borderColor: colors.border, marginTop: 4 }]}>
                {teachers.length === 0 ? (
                  <Text style={{ color: colors.textSecondary, padding: 12 }}>No teachers available.</Text>
                ) : (
                  teachers.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.teacherPickerItem,
                        { borderColor: colors.border },
                        recommendedTeacherId === t.id && { backgroundColor: colors.success + '15', borderColor: colors.success },
                      ]}
                      onPress={() => setRecommendedTeacherId(t.id)}
                    >
                      <View style={[styles.teacherPickerDot, { backgroundColor: recommendedTeacherId === t.id ? colors.success : colors.border }]} />
                      <Text style={[styles.teacherPickerName, { color: colors.text }]}>{t.name}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              <Button
                title="Submit Assessment"
                onPress={handleSubmitInterview}
                loading={submitting}
                style={{ backgroundColor: colors.success, marginTop: 24, borderRadius: 12, height: 50 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 14-DAY PROGRESS REVIEW MODAL */}
      <Modal visible={selectedReview !== null} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>14-Day Progress Review</Text>
                <Text style={[styles.modalStudentSub, { color: colors.textSecondary }]}>
                  Student: {selectedReview?.student_name}
                </Text>
              </View>
              <TouchableOpacity onPress={resetForm}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              {prevInterview && (
                <View style={[styles.calcCard, { backgroundColor: colors.secondary + '08', borderColor: colors.secondary + '20', marginBottom: 20 }]}>
                  <Text style={[styles.prevScoresHeader, { color: colors.secondary }]}>Admission Score Details</Text>
                  <Text style={[styles.calcLabel, { color: colors.text, marginTop: 4 }]}>
                    English: {prevInterview.english} | Comm: {prevInterview.communication} | Conf: {prevInterview.confidence} | Tech: {prevInterview.technical_skills} | Learn: {prevInterview.learning_ability}
                  </Text>
                  <Text style={[styles.calcLabel, { color: colors.textSecondary, marginTop: 4, fontWeight: '700' }]}>
                    Admission Total: {prevInterview.total_score} / 50 ({prevInterview.assigned_level})
                  </Text>
                </View>
              )}

              {/* Category: English */}
              <View style={styles.scoreRowContainer}>
                <Text style={[styles.scoreLabel, { color: colors.text }]}>English Vocabulary & Grammar</Text>
                <View style={styles.scorePills}>
                  {SCORE_OPTIONS.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scorePill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        english === num && { backgroundColor: colors.warning, borderColor: colors.warning },
                      ]}
                      onPress={() => setEnglish(num)}
                    >
                      <Text style={[styles.scorePillText, { color: colors.text }, english === num && { color: colors.white }]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category: Communication */}
              <View style={styles.scoreRowContainer}>
                <Text style={[styles.scoreLabel, { color: colors.text }]}>Communication Skills</Text>
                <View style={styles.scorePills}>
                  {SCORE_OPTIONS.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scorePill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        communication === num && { backgroundColor: colors.warning, borderColor: colors.warning },
                      ]}
                      onPress={() => setCommunication(num)}
                    >
                      <Text style={[styles.scorePillText, { color: colors.text }, communication === num && { color: colors.white }]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category: Confidence */}
              <View style={styles.scoreRowContainer}>
                <Text style={[styles.scoreLabel, { color: colors.text }]}>Confidence Level</Text>
                <View style={styles.scorePills}>
                  {SCORE_OPTIONS.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scorePill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        confidence === num && { backgroundColor: colors.warning, borderColor: colors.warning },
                      ]}
                      onPress={() => setConfidence(num)}
                    >
                      <Text style={[styles.scorePillText, { color: colors.text }, confidence === num && { color: colors.white }]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category: Technical */}
              <View style={styles.scoreRowContainer}>
                <Text style={[styles.scoreLabel, { color: colors.text }]}>Technical Skills & Aptitude</Text>
                <View style={styles.scorePills}>
                  {SCORE_OPTIONS.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scorePill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        technical === num && { backgroundColor: colors.warning, borderColor: colors.warning },
                      ]}
                      onPress={() => setTechnical(num)}
                    >
                      <Text style={[styles.scorePillText, { color: colors.text }, technical === num && { color: colors.white }]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category: Learning */}
              <View style={styles.scoreRowContainer}>
                <Text style={[styles.scoreLabel, { color: colors.text }]}>Learning Ability</Text>
                <View style={styles.scorePills}>
                  {SCORE_OPTIONS.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scorePill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        learning === num && { backgroundColor: colors.warning, borderColor: colors.warning },
                      ]}
                      onPress={() => setLearning(num)}
                    >
                      <Text style={[styles.scorePillText, { color: colors.text }, learning === num && { color: colors.white }]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Real-time Calculation summary */}
              <View style={[styles.calcCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>Calculated Total Score:</Text>
                  <Text style={[styles.calcValue, { color: colors.text }]}>{calculatedTotal} / 50</Text>
                </View>
                {prevInterview && (
                  <View style={styles.calcRow}>
                    <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>Growth Percentage:</Text>
                    <Text style={[
                      styles.calcValue,
                      { color: calculatedTotal - prevInterview.total_score >= 0 ? colors.success : colors.danger }
                    ]}>
                      {prevInterview.total_score > 0
                        ? Math.round(((calculatedTotal - prevInterview.total_score) / prevInterview.total_score) * 100)
                        : 0}%
                    </Text>
                  </View>
                )}
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>Assigned Level:</Text>
                  <View style={[
                    styles.levelBadgeInline,
                    { backgroundColor: calculatedLevel === 'Advanced' ? colors.success + '15' : calculatedLevel === 'Intermediate' ? colors.secondary + '15' : colors.danger + '15' }
                  ]}>
                    <Text style={[
                      styles.levelBadgeTextInline,
                      { color: calculatedLevel === 'Advanced' ? colors.success : calculatedLevel === 'Intermediate' ? colors.secondary : colors.danger }
                    ]}>
                      {calculatedLevel}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Strengths Input */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Strengths</Text>
              <TextInput
                style={[styles.textArea, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
                multiline
                placeholder="What did the candidate excel at?"
                placeholderTextColor={colors.textSecondary}
                value={strengths}
                onChangeText={setStrengths}
              />

              {/* Weaknesses Input */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Weaknesses</Text>
              <TextInput
                style={[styles.textArea, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
                multiline
                placeholder="Where does the candidate need improvement?"
                placeholderTextColor={colors.textSecondary}
                value={weaknesses}
                onChangeText={setWeaknesses}
              />

              {/* Recommendations Input */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Recommendations / Notes</Text>
              <TextInput
                style={[styles.textArea, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
                multiline
                placeholder="Enter final recommendation notes..."
                placeholderTextColor={colors.textSecondary}
                value={recommendations}
                onChangeText={setRecommendations}
              />

              <Button
                title="Submit Progress Review"
                onPress={handleSubmitReview}
                loading={submitting}
                style={{ backgroundColor: colors.warning, marginTop: 24, borderRadius: 12, height: 50 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* VIEW DETAILS MODAL */}
      <Modal visible={viewingInterview !== null} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: '80%' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Assessment Details</Text>
                <Text style={[styles.modalStudentSub, { color: colors.textSecondary }]}>
                  Student: {viewingInterview?.student_name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setViewingInterview(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {/* Type and Level */}
              <View style={[styles.calcCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>Type:</Text>
                  <Text style={[styles.calcValue, { color: colors.text, textTransform: 'capitalize' }]}>
                    {viewingInterview?.interview_type === 'admission' ? 'Admission Interview' : '14-Day Progress Review'}
                  </Text>
                </View>
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>Level:</Text>
                  <View style={[
                    styles.levelBadgeInline,
                    { backgroundColor: viewingInterview?.assigned_level === 'Advanced' ? colors.success + '15' : viewingInterview?.assigned_level === 'Intermediate' ? colors.secondary + '15' : colors.danger + '15' }
                  ]}>
                    <Text style={[
                      styles.levelBadgeTextInline,
                      { color: viewingInterview?.assigned_level === 'Advanced' ? colors.success : viewingInterview?.assigned_level === 'Intermediate' ? colors.secondary : colors.danger }
                    ]}>
                      {viewingInterview?.assigned_level}
                    </Text>
                  </View>
                </View>
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>Total Score:</Text>
                  <Text style={[styles.calcValue, { color: colors.text, fontWeight: '700' }]}>
                    {viewingInterview?.total_score} / 50
                  </Text>
                </View>
              </View>

              {/* Sub-Scores List */}
              <Text style={[styles.inputLabel, { color: colors.text, marginTop: 16 }]}>Detailed Scores</Text>
              <View style={[styles.detailScoresBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={[styles.detailScoreRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailScoreLabel, { color: colors.text }]}>English Vocabulary & Grammar</Text>
                  <Text style={[styles.detailScoreVal, { color: colors.primary }]}>{viewingInterview?.english} / 10</Text>
                </View>
                <View style={[styles.detailScoreRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailScoreLabel, { color: colors.text }]}>Communication Skills</Text>
                  <Text style={[styles.detailScoreVal, { color: colors.primary }]}>{viewingInterview?.communication} / 10</Text>
                </View>
                <View style={[styles.detailScoreRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailScoreLabel, { color: colors.text }]}>Confidence Level</Text>
                  <Text style={[styles.detailScoreVal, { color: colors.primary }]}>{viewingInterview?.confidence} / 10</Text>
                </View>
                <View style={[styles.detailScoreRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailScoreLabel, { color: colors.text }]}>Technical Skills & Aptitude</Text>
                  <Text style={[styles.detailScoreVal, { color: colors.primary }]}>{viewingInterview?.technical_skills} / 10</Text>
                </View>
                <View style={styles.detailScoreRow}>
                  <Text style={[styles.detailScoreLabel, { color: colors.text }]}>Learning Ability</Text>
                  <Text style={[styles.detailScoreVal, { color: colors.primary }]}>{viewingInterview?.learning_ability} / 10</Text>
                </View>
              </View>

              {/* Strengths */}
              <Text style={[styles.inputLabel, { color: colors.text, marginTop: 16 }]}>Strengths</Text>
              <View style={[styles.detailTextArea, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text }}>{viewingInterview?.strengths || 'None logged.'}</Text>
              </View>

              {/* Weaknesses */}
              <Text style={[styles.inputLabel, { color: colors.text, marginTop: 16 }]}>Weaknesses</Text>
              <View style={[styles.detailTextArea, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text }}>{viewingInterview?.weaknesses || 'None logged.'}</Text>
              </View>

              {/* Recommendations */}
              <Text style={[styles.inputLabel, { color: colors.text, marginTop: 16 }]}>Recommendations / Notes</Text>
              <View style={[styles.detailTextArea, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text }}>{viewingInterview?.recommendations || 'None logged.'}</Text>
              </View>

              <Button
                title="Close"
                onPress={() => setViewingInterview(null)}
                style={{ backgroundColor: colors.secondary, marginTop: 24, borderRadius: 12, height: 45 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
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
  sectionHeaderContainer: {
    marginBottom: 12,
    paddingLeft: 4,
  },
  sectionTitleHeader: {
    fontSize: 19,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  emptyCardText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  cardList: {
    gap: 12,
  },
  itemCard: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  initialCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  initialText: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 22,
    fontWeight: '700',
  },
  studentEmail: {
    fontSize: 11.5,
    marginTop: 1,
  },
  conductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 6,
    borderRadius: 17,
    elevation: 2,
  },
  conductButtonText: {
    fontSize: 14,
    paddingTop: 5,
    fontWeight: '700',
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
  historyList: {
    gap: 12,
  },
  historyCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyTypeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  historyDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  historyStudentName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  historyScoresSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreSummaryText: {
    fontSize: 12,
    maxWidth: '60%',
  },
  profileCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  profileEmail: {
    fontSize: 13.5,
    marginTop: 2,
  },
  roleLabel: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
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
    padding: 16,
    borderBottomWidth: 1,
  },
  profileRowLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  profileRowVal: {
    fontSize: 13.5,
    fontWeight: '400',
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalStudentSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  scoreRowContainer: {
    marginBottom: 20,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  scorePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  scorePill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  scorePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  calcCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 20,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  calcValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  levelBadgeInline: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelBadgeTextInline: {
    fontSize: 10,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  textArea: {
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  prevScoresHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailScoresBox: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  detailScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  detailScoreLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  detailScoreVal: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  detailTextArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    marginBottom: 16,
  },
  teacherPickerContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  teacherPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
  },
  teacherPickerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  teacherPickerName: {
    fontSize: 14,
    fontWeight: '500',
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20,
    alignItems: 'center',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
