import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { admissionService } from '../../services/admissionService';
import { analyticsService } from '../../services/analyticsService';
import { Profile, StudentProgressReview } from '../../types';
import { supabase } from '../../utils/supabase';

type TabKey = 'awaiting_approval' | 'pending_reviews' | 'analytics';

export default function AdminInterviewsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('awaiting_approval');

  // Data State
  const [awaitingInterviews, setAwaitingInterviews] = useState<any[]>([]);
  const [pendingReviews, setPendingReviews] = useState<StudentProgressReview[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  // Selectors Data
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Approval Modal State
  const [selectedInterview, setSelectedInterview] = useState<any | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [classText, setClassText] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState<string>('');

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);
      const [interviewsData, reviewsData, analyticsData, teachersData, coursesData] = await Promise.all([
        admissionService.getPendingAdminReviews().catch(() => []),
        admissionService.getFortnightReviews('pending').catch(() => []),
        analyticsService.getAdminInterviewAnalytics().catch(() => null),
        adminService.getTeachers().catch(() => []),
        supabase.from('courses').select('id, name, code, course_teachers(teacher_id)').then(res => res.data || []),
      ]);

      setAwaitingInterviews(interviewsData);
      setPendingReviews(reviewsData);
      setAnalytics(analyticsData);
      setTeachers(teachersData.filter((t) => t.approved));
      setCourses(coursesData);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const openApproveModal = (interview: any) => {
    setSelectedInterview(interview);
    const deal = interview.deal;

    // Prioritize Deal data, then recommended, then default to empty
    const courseId = deal?.course_id || interview.recommended_course_id || '';
    setSelectedCourseId(courseId);

    let teacherId = deal?.teacher_id || interview.recommended_teacher_id || '';
    if (!teacherId && courseId) {
      const selectedCourseObj = courses.find((c) => c.id === courseId);
      teacherId = selectedCourseObj?.course_teachers?.[0]?.teacher_id || '';
    }
    setSelectedTeacherId(teacherId);

    const classVal = deal?.class || '';
    setClassText(classVal);
    setAdminNotes('');
  };

  const closeApproveModal = () => {
    setSelectedInterview(null);
  };

  const handleApprove = async () => {
    if (!selectedInterview || !user?.id) return;
    if (!selectedTeacherId) {
      Alert.alert('Validation Error', 'Please select a teacher.');
      return;
    }
    if (!selectedCourseId) {
      Alert.alert('Validation Error', 'Please select a course.');
      return;
    }
    if (!classText.trim()) {
      Alert.alert('Validation Error', 'Please enter a class.');
      return;
    }

    try {
      setActionLoading(true);
      await admissionService.approveStudentAdmissionWorkflow({
        interviewId: selectedInterview.id,
        adminId: user.id,
        notes: adminNotes.trim(),
        teacherId: selectedTeacherId,
        class: classText.trim(),
        courseId: selectedCourseId,
      });

      Alert.alert('Success', 'Student has been officially admitted! The assigned teacher has been notified, and the student is now enrolled in the attendance system.');
      closeApproveModal();
      fetchData(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to approve admission');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedInterview || !user?.id) return;
    try {
      setActionLoading(true);
      await admissionService.rejectStudentAdmissionWorkflow({
        interviewId: selectedInterview.id,
        adminId: user.id,
        notes: adminNotes.trim(),
      });

      Alert.alert('Success', 'Admission interview rejected.');
      closeApproveModal();
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reject admission');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIconBg, { backgroundColor: colors.primary + '15' }]}>
            <MaterialIcons name="analytics" size={28} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Interview Board</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Review candidate assessments and fortnight progress
            </Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(['awaiting_approval', 'pending_reviews', 'analytics'] as TabKey[]).map((tab) => {
            const label = tab === 'awaiting_approval' ? 'Awaiting Approval' : tab === 'pending_reviews' ? 'Fortnight Reviews' : 'Interview Analytics';
            const count = tab === 'awaiting_approval' ? awaitingInterviews.length : tab === 'pending_reviews' ? pendingReviews.length : 0;
            const activeColor = tab === 'awaiting_approval' ? colors.primary : tab === 'pending_reviews' ? colors.warning : colors.success;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabBtn,
                  activeTab === tab && { borderBottomColor: activeColor, borderBottomWidth: 3 },
                ]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabBtnText, { color: activeTab === tab ? activeColor : colors.textSecondary }]}>
                  {label} {count > 0 ? `(${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading data...</Text>
          </View>
        ) : activeTab === 'awaiting_approval' ? (
          awaitingInterviews.length === 0 ? (
            <EmptyState icon="check-circle" text="No interviews awaiting approval." colors={colors} />
          ) : (
            awaitingInterviews.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => openApproveModal(item)}
              >
                <View style={[styles.cardAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.cardAvatarText, { color: colors.primary }]}>
                    {item.student_name ? item.student_name.charAt(0).toUpperCase() : 'S'}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.student_name}</Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]} numberOfLines={1}>ASR: {item.interviewer_name || 'N/A'}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.statusBadgeText, { color: colors.primary }]}>Score: {item.total_score}/50 ({item.assigned_level})</Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            ))
          )
        ) : activeTab === 'pending_reviews' ? (
          pendingReviews.length === 0 ? (
            <EmptyState icon="check-circle" text="No pending progress reviews." colors={colors} />
          ) : (
            pendingReviews.map((rev) => (
              <View
                key={rev.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={[styles.cardAvatar, { backgroundColor: colors.warning + '20' }]}>
                  <Text style={[styles.cardAvatarText, { color: colors.warning }]}>
                    {rev.student_name ? rev.student_name.charAt(0).toUpperCase() : 'R'}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                    {rev.student_name || 'Student'}
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                    Due: {rev.scheduled_date ? new Date(rev.scheduled_date).toLocaleDateString() : '—'}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: colors.warning + '15' }]}>
                    <Text style={[styles.statusBadgeText, { color: colors.warning }]}>Fortnight Review #{rev.review_number}</Text>
                  </View>
                </View>
              </View>
            ))
          )
        ) : (
          /* Analytics Tab */
          analytics ? (
            <View style={{ gap: 20 }}>
              {/* Level Distribution */}
              <View style={[styles.analyticCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.analyticTitle, { color: colors.text }]}>Admitted Student Levels</Text>
                <View style={styles.levelsRow}>
                  <View style={styles.levelStat}>
                    <Text style={[styles.levelVal, { color: colors.danger }]}>{analytics.levels?.Beginner || 0}</Text>
                    <Text style={[styles.levelLbl, { color: colors.textSecondary }]}>Beginner</Text>
                  </View>
                  <View style={styles.levelStat}>
                    <Text style={[styles.levelVal, { color: colors.secondary }]}>{analytics.levels?.Intermediate || 0}</Text>
                    <Text style={[styles.levelLbl, { color: colors.textSecondary }]}>Intermediate</Text>
                  </View>
                  <View style={styles.levelStat}>
                    <Text style={[styles.levelVal, { color: colors.success }]}>{analytics.levels?.Advanced || 0}</Text>
                    <Text style={[styles.levelLbl, { color: colors.textSecondary }]}>Advanced</Text>
                  </View>
                </View>
              </View>

              {/* Fortnight Review Metrics */}
              <View style={[styles.analyticCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.analyticTitle, { color: colors.text }]}>Fortnight Review Compliance</Text>
                <View style={styles.metricsRow}>
                  <View style={styles.metricBlock}>
                    <Text style={[styles.metricVal, { color: colors.text }]}>{analytics.fortnightMetrics?.completed || 0}</Text>
                    <Text style={[styles.metricLbl, { color: colors.textSecondary }]}>Completed</Text>
                  </View>
                  <View style={styles.metricBlock}>
                    <Text style={[styles.metricVal, { color: colors.text }]}>{analytics.fortnightMetrics?.pending || 0}</Text>
                    <Text style={[styles.metricLbl, { color: colors.textSecondary }]}>Pending</Text>
                  </View>
                  <View style={styles.metricBlock}>
                    <Text style={[styles.metricVal, { color: colors.success }]}>
                      {Math.round(analytics.fortnightMetrics?.completionRate || 0)}%
                    </Text>
                    <Text style={[styles.metricLbl, { color: colors.textSecondary }]}>Completion Rate</Text>
                  </View>
                </View>
              </View>

              {/* Teacher Performance */}
              <View style={[styles.analyticCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.analyticTitle, { color: colors.text }]}>Teacher Progress Reports Performance</Text>
                {analytics.teacherPerformance?.length === 0 ? (
                  <Text style={{ color: colors.textSecondary, fontStyle: 'italic', paddingVertical: 8 }}>No reports submitted yet.</Text>
                ) : (
                  analytics.teacherPerformance?.map((tp: any, index: number) => (
                    <View key={index} style={[styles.teacherPerfRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.teacherPerfName, { color: colors.text }]}>{tp.name}</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: colors.success, fontWeight: '700', fontSize: 13 }}>Avg. Growth: {Math.round(tp.averageImprovement)}%</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{tp.reportsCount} Reports</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Growth Tracking Reviews */}
              <View style={[styles.analyticCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.analyticTitle, { color: colors.text }]}>Recent Growth Checks</Text>
                {analytics.growthTracking?.length === 0 ? (
                  <Text style={{ color: colors.textSecondary, fontStyle: 'italic', paddingVertical: 8 }}>No progress reviews completed.</Text>
                ) : (
                  analytics.growthTracking?.map((gt: any) => (
                    <View key={gt.id} style={[styles.teacherPerfRow, { borderBottomColor: colors.border }]}>
                      <View>
                        <Text style={[styles.teacherPerfName, { color: colors.text }]}>{gt.studentName}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Date: {new Date(gt.date).toLocaleDateString()}</Text>
                      </View>
                      <Text style={[styles.calcValue, { color: colors.success }]}>Score: {gt.score}/50</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          ) : (
            <EmptyState icon="analytics" text="No analytics records found." colors={colors} />
          )
        )}
      </ScrollView>

      {/* APPROVAL DECISION MODAL */}
      <Modal visible={selectedInterview !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Review & Approve Admission</Text>
                <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                  {selectedInterview?.student_name}
                </Text>
              </View>
              <TouchableOpacity onPress={closeApproveModal}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {/* Scores summary */}
              <View style={[styles.scoreBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.fieldLabel, { color: colors.text, marginBottom: 8 }]}>ASR Assessment Results</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  English: {selectedInterview?.english}/10 | Comm: {selectedInterview?.communication}/10 | Conf: {selectedInterview?.confidence}/10 | Tech: {selectedInterview?.technical_skills}/10 | Learn: {selectedInterview?.learning_ability}/10
                </Text>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, marginTop: 4 }}>
                  Assigned Level: {selectedInterview?.assigned_level} (Total: {selectedInterview?.total_score}/50)
                </Text>
                
                <View style={{ marginTop: 12, padding: 10, backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={[styles.fieldLabel, { color: colors.text, fontSize: 12, marginBottom: 4 }]}>ASR Recommendations:</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Course: {selectedInterview?.recommended_course_name || 'Not specified'}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Teacher: {selectedInterview?.recommended_teacher_name || 'Not specified'}</Text>
                </View>

                {selectedInterview?.strengths && <Text style={{ color: colors.text, fontSize: 12, marginTop: 10 }}>Strengths: {selectedInterview.strengths}</Text>}
                {selectedInterview?.weaknesses && <Text style={{ color: colors.text, fontSize: 12, marginTop: 2 }}>Weaknesses: {selectedInterview.weaknesses}</Text>}
                {selectedInterview?.recommendations && <Text style={{ color: colors.text, fontSize: 12, marginTop: 2 }}>ASR notes: {selectedInterview.recommendations}</Text>}
              </View>

              {/* Admin Confirmation of ASR recommendations */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>Confirm/Adjust Assigned Course</Text>
              <View style={[styles.pickerContainer, { borderColor: colors.border }]}>
                {courses.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.pickerItem,
                      { borderColor: colors.border },
                      selectedCourseId === c.id && { backgroundColor: colors.primary + '15', borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      setSelectedCourseId(c.id);
                      const officialTeacherId = c.course_teachers?.[0]?.teacher_id;
                      if (officialTeacherId) {
                        setSelectedTeacherId(officialTeacherId);
                      }
                    }}
                  >
                    <View style={[styles.pickerDot, { backgroundColor: selectedCourseId === c.id ? colors.primary : colors.border }]} />
                    <Text style={[styles.pickerName, { color: colors.text }]}>{c.name} ({c.code})</Text>
                    {selectedInterview?.recommended_course_id === c.id && (
                      <View style={{ marginLeft: 'auto', backgroundColor: colors.success + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, color: colors.success, fontWeight: '700' }}>ASR PICK</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>Confirm/Adjust Assigned Teacher</Text>
              <View style={[styles.pickerContainer, { borderColor: colors.border }]}>
                {teachers.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.pickerItem,
                      { borderColor: colors.border },
                      selectedTeacherId === t.id && { backgroundColor: colors.primary + '15', borderColor: colors.primary },
                    ]}
                    onPress={() => setSelectedTeacherId(t.id)}
                  >
                    <View style={[styles.pickerDot, { backgroundColor: selectedTeacherId === t.id ? colors.primary : colors.border }]} />
                    <Text style={[styles.pickerName, { color: colors.text }]}>{t.name}</Text>
                    {selectedInterview?.recommended_teacher_id === t.id && (
                      <View style={{ marginLeft: 'auto', backgroundColor: colors.success + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, color: colors.success, fontWeight: '700' }}>ASR PICK</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>Class Name (Final)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. Class 10-A"
                placeholderTextColor={colors.textSecondary}
                value={classText}
                onChangeText={setClassText}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>Admin Decision Notes</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, height: 60, textAlignVertical: 'top' }]}
                placeholder="Final notes for admission approval or rejection..."
                placeholderTextColor={colors.textSecondary}
                multiline
                value={adminNotes}
                onChangeText={setAdminNotes}
              />

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 20 }}>
                <TouchableOpacity
                  style={[styles.actionBtn, { flex: 1.2, backgroundColor: colors.success }]}
                  onPress={handleApprove}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionBtnText}>Approve Assessment</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { flex: 0.8, backgroundColor: colors.danger }]}
                  onPress={handleReject}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionBtnText}>Reject</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function EmptyState({ icon, text, colors }: { icon: any; text: string; colors: any }) {
  return (
    <View style={styles.emptyState}>
      <MaterialIcons name={icon} size={56} color={colors.textSecondary} />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerIconBg: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 3 },
  subtitle: { fontSize: 13 },
  tabBar: {
    flexDirection: 'row', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, marginBottom: 20,
  },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnText: { fontSize: 12.5, fontWeight: '700' },
  loadingContainer: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 16, borderWidth: 1, marginBottom: 10,
  },
  cardAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardAvatarText: { fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardMeta: { fontSize: 12, marginBottom: 4 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 16, fontSize: 15, textAlign: 'center', maxWidth: 260 },

  // Analytics styles
  analyticCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10 },
  analyticTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  levelsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  levelStat: { alignItems: 'center' },
  levelVal: { fontSize: 24, fontWeight: '800', marginBottom: 2 },
  levelLbl: { fontSize: 12, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  metricBlock: { alignItems: 'center' },
  metricVal: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  metricLbl: { fontSize: 11, fontWeight: '600' },
  teacherPerfRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  teacherPerfName: { fontSize: 13.5, fontWeight: '700' },
  calcValue: { fontSize: 13.5, fontWeight: '800' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSub: { fontSize: 13, marginTop: 2 },
  scoreBlock: { padding: 12, borderRadius: 12, borderWidth: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerContainer: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginTop: 8 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1 },
  pickerDot: { width: 14, height: 14, borderRadius: 7 },
  pickerName: { fontSize: 13.5, fontWeight: '600' },
  textInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13.5, marginTop: 8 },
  actionBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
