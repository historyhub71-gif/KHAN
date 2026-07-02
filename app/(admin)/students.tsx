import { Ionicons } from '@expo/vector-icons';
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
import { Course, Profile, StudentProfile } from '../../types';

type StudentWithProfile = Profile & { studentProfile?: StudentProfile };

export default function StudentsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const studentData = await adminService.getStudentsWithProfiles();
      setStudents(studentData);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load data');
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
    fetchData();
  };

  const handleDelete = (student: StudentWithProfile) => {
    Alert.alert(
      'Delete Student',
      `Permanently delete "${student.name}"?\n\nThis will remove all their records including attendance, fees, interviews, notifications, and revoke login access. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic UI: remove instantly from visible list
            setStudents((prev) => prev.filter((s) => s.id !== student.id));
            try {
              await adminService.deleteStudent(student.id);
              Alert.alert('Deleted', `${student.name} has been completely removed from the system.`);
            } catch (_err: any) {
              // Rollback: restore student in list if deletion failed
              setStudents((prev) => {
                const exists = prev.some((s) => s.id === student.id);
                if (exists) return prev;
                return [student, ...prev];
              });
              Alert.alert('Error', _err?.message || 'Failed to delete student. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleApprove = async (student: StudentWithProfile) => {
    if (!user?.id) return;
    try {
      setIsSubmitting(true);
      if ((student as any).pendingInterviewId) {
        // If there's an interview, use the unified workflow (which handles teacher, enroll, etc.)
        await admissionService.approveStudentAdmissionWorkflow({
          interviewId: (student as any).pendingInterviewId,
          adminId: user.id,
          notes: 'Approved via Student Management dashboard',
        });
        Alert.alert('Success', 'Admission approved! Student is now active and enrolled.');
      } else {
        // Fallback for simple approval
        await adminService.approveStudent(student.id);
        Alert.alert('Success', 'Student profile approved.');
      }
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to approve student');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (student: StudentWithProfile) => {
    if (!user?.id) return;
    Alert.alert('Reject Student', 'Are you sure you want to reject this student?', [
      { text: 'Cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsSubmitting(true);
            if ((student as any).pendingInterviewId) {
              await admissionService.rejectStudentAdmissionWorkflow({
                interviewId: (student as any).pendingInterviewId,
                adminId: user.id,
                notes: 'Rejected via Student Management dashboard',
              });
            } else {
              await adminService.rejectStudent(student.id);
            }
            fetchData();
            Alert.alert('Success', 'Student rejected');
          } catch (_err) {
            Alert.alert('Error', 'Failed to reject student');
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  };

  const getLevelColor = (level: string | null) => {
    switch (level) {
      case 'Advanced': return colors.success;
      case 'Intermediate': return colors.warning;
      case 'Elementary': return '#f59e0b';
      default: return colors.danger;
    }
  };

  const isAdmitted = (s: StudentWithProfile) =>
    !!(s.studentProfile?.assigned_teacher_id && s.studentProfile?.class);

  const getAdmissionStatus = (s: StudentWithProfile) => {
    if (isAdmitted(s)) return { label: 'ADMITTED', color: colors.success };
    if (s.approved) return { label: 'APPROVED (READY)', color: colors.primary };
    if (s.status === 'rejected') return { label: 'REJECTED', color: colors.danger };
    if (s.status === 'waiting_approval') return { label: 'INTERVIEW PENDING', color: colors.warning };
    return { label: 'PENDING', color: colors.textSecondary };
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.headerSection}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Student Admissions</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
            Manage student approvals, assign classes and teachers
          </Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.primary }]}>{students.filter((s) => s.approved).length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Approved</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.warning }]}>{students.filter((s) => !s.approved && s.status !== 'rejected').length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.success }]}>{students.filter((s) => isAdmitted(s)).length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Admitted</Text>
          </View>
        </View>

        {students.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No students registered yet.</Text>
          </View>
        ) : (
          students.map((student) => (
            <View
              key={student.id}
              style={[styles.studentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={[styles.avatarCircle, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {student.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cardHeaderInfo}>
                  <Text style={[styles.studentName, { color: colors.text }]}>{student.name}</Text>
                  <Text style={[styles.studentEmail, { color: colors.textSecondary }]}>{student.email}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getAdmissionStatus(student).color + '20' }
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    { color: getAdmissionStatus(student).color }
                  ]}>
                    {getAdmissionStatus(student).label}
                  </Text>
                </View>
              </View>

              {/* Profile Info Row */}
              {student.studentProfile && (
                <View style={[styles.profileInfoRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  {student.studentProfile.level && (
                    <View style={[styles.infoPill, { backgroundColor: getLevelColor(student.studentProfile.level) + '20' }]}>
                      <Text style={[styles.infoPillText, { color: getLevelColor(student.studentProfile.level) }]}>
                        {student.studentProfile.level}
                      </Text>
                    </View>
                  )}
                  {student.studentProfile.class && (
                    <View style={[styles.infoPill, { backgroundColor: colors.secondary + '20' }]}>
                      <Text style={[styles.infoPillText, { color: colors.secondary }]}>
                        Class {student.studentProfile.class}
                      </Text>
                    </View>
                  )}
                  {student.studentProfile.section && (
                    <View style={[styles.infoPill, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.infoPillText, { color: colors.primary }]}>
                        Sec. {student.studentProfile.section}
                      </Text>
                    </View>
                  )}
                  {student.studentProfile.teacher_name && (
                    <View style={[styles.infoPill, { backgroundColor: colors.success + '15' }]}>
                      <Ionicons name="person" size={11} color={colors.success} />
                      <Text style={[styles.infoPillText, { color: colors.success }]}>
                        {student.studentProfile.teacher_name}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.cardActions}>
                {!student.approved && student.status !== 'rejected' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.success }]}
                    onPress={() => handleApprove(student)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                        <Text style={styles.actionBtnText}>
                          {(student as any).pendingInterviewId ? 'Review & Approve' : 'Approve'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {student.status !== 'rejected' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.warning + 'cc' }]}
                    onPress={() => handleReject(student)}
                    disabled={isSubmitting}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                  onPress={() => handleDelete(student)}
                  disabled={isSubmitting}
                >
                  <Ionicons name="trash" size={14} color="#fff" />
                  <Text style={styles.actionBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { padding: 20, paddingBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { fontSize: 13, fontWeight: '400' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '500' },
  studentCard: {
    marginHorizontal: 20, marginBottom: 14, borderRadius: 16, borderWidth: 1, overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' },
  cardHeaderInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '700' },
  studentEmail: { fontSize: 12, marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  profileInfoRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderBottomWidth: 1,
  },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  infoPillText: { fontSize: 11, fontWeight: '600' },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10,
  },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  emptyCard: {
    margin: 20, padding: 40, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 12,
  },
  emptyText: { fontSize: 14, fontWeight: '500' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSub: { fontSize: 13, marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  teacherPickerContainer: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  teacherPickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1,
  },
  teacherPickerDot: { width: 14, height: 14, borderRadius: 7 },
  teacherPickerName: { fontSize: 14, fontWeight: '500' },
  textInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
  },
  submitBtn: {
    marginTop: 24, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
