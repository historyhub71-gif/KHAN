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
import { adminService } from '../../services/adminService';
import { Profile, StudentProfile } from '../../types';

type StudentWithProfile = Profile & { studentProfile?: StudentProfile };

export default function StudentsScreen() {
  const { colors } = useTheme();
  const [students, setStudents] = useState<StudentWithProfile[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Admit modal state
  const [admitTarget, setAdmitTarget] = useState<StudentWithProfile | null>(null);
  const [assignedTeacherId, setAssignedTeacherId] = useState('');
  const [classText, setClassText] = useState('');
  const [sectionText, setSectionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [studentsData, teachersData] = await Promise.all([
        adminService.getStudentsWithProfiles(),
        adminService.getTeachers(),
      ]);
      setStudents(studentsData);
      setTeachers(teachersData.filter((t) => t.approved));
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load students');
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

  const handleDelete = (studentId: string) => {
    Alert.alert('Delete Student', 'Are you sure you want to delete this student?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminService.deleteStudent(studentId);
            fetchData();
            Alert.alert('Success', 'Student deleted successfully');
          } catch (err) {
            Alert.alert('Error', 'Failed to delete student');
          }
        },
      },
    ]);
  };

  const handleApprove = async (studentId: string) => {
    try {
      await adminService.approveStudent(studentId);
      fetchData();
      Alert.alert('Success', 'Student approved successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to approve student');
    }
  };

  const handleReject = async (studentId: string) => {
    Alert.alert('Reject Student', 'Are you sure you want to reject this student?', [
      { text: 'Cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminService.rejectStudent(studentId);
            fetchData();
            Alert.alert('Success', 'Student rejected');
          } catch (err) {
            Alert.alert('Error', 'Failed to reject student');
          }
        },
      },
    ]);
  };

  const openAdmitModal = (student: StudentWithProfile) => {
    setAdmitTarget(student);
    setAssignedTeacherId(student.studentProfile?.assigned_teacher_id || '');
    setClassText(student.studentProfile?.class || '');
    setSectionText(student.studentProfile?.section || '');
  };

  const handleAdmit = async () => {
    if (!admitTarget) return;
    if (!assignedTeacherId.trim()) {
      Alert.alert('Validation', 'Please select an assigned teacher.');
      return;
    }
    if (!classText.trim() || !sectionText.trim()) {
      Alert.alert('Validation', 'Please enter class and section.');
      return;
    }
    try {
      setIsSubmitting(true);
      await adminService.admitStudent({
        studentId: admitTarget.id,
        assignedTeacherId,
        class: classText.trim(),
        section: sectionText.trim(),
      });
      Alert.alert('Success', `${admitTarget.name} has been formally admitted.`);
      setAdmitTarget(null);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to admit student');
    } finally {
      setIsSubmitting(false);
    }
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
                  {
                    backgroundColor: student.approved
                      ? colors.success + '20'
                      : student.status === 'rejected'
                        ? colors.danger + '20'
                        : colors.warning + '20'
                  }
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    {
                      color: student.approved
                        ? colors.success
                        : student.status === 'rejected'
                          ? colors.danger
                          : colors.warning
                    }
                  ]}>
                    {student.approved ? 'APPROVED' : student.status === 'rejected' ? 'REJECTED' : 'PENDING'}
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
                    onPress={() => handleApprove(student.id)}
                  >
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                )}

                {student.approved && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: isAdmitted(student) ? colors.secondary : colors.primary }]}
                    onPress={() => openAdmitModal(student)}
                  >
                    <Ionicons name={isAdmitted(student) ? 'create-outline' : 'school'} size={14} color="#fff" />
                    <Text style={styles.actionBtnText}>{isAdmitted(student) ? 'Edit Admission' : 'Admit Student'}</Text>
                  </TouchableOpacity>
                )}

                {student.status !== 'rejected' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.warning + 'cc' }]}
                    onPress={() => handleReject(student.id)}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                  onPress={() => handleDelete(student.id)}
                >
                  <Ionicons name="trash" size={14} color="#fff" />
                  <Text style={styles.actionBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Admit Modal */}
      <Modal visible={admitTarget !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Formal Admission</Text>
                <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                  {admitTarget?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAdmitTarget(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Assign Teacher</Text>
              <View style={[styles.teacherPickerContainer, { borderColor: colors.border }]}>
                {teachers.length === 0 ? (
                  <Text style={{ color: colors.textSecondary, padding: 12 }}>No approved teachers available.</Text>
                ) : (
                  teachers.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.teacherPickerItem,
                        { borderColor: colors.border },
                        assignedTeacherId === t.id && { backgroundColor: colors.primary + '15', borderColor: colors.primary },
                      ]}
                      onPress={() => setAssignedTeacherId(t.id)}
                    >
                      <View style={[styles.teacherPickerDot, { backgroundColor: assignedTeacherId === t.id ? colors.primary : colors.border }]} />
                      <Text style={[styles.teacherPickerName, { color: colors.text }]}>{t.name}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>Class</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. 10A, Grade 5"
                placeholderTextColor={colors.textSecondary}
                value={classText}
                onChangeText={setClassText}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>Section</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. A, B, Morning"
                placeholderTextColor={colors.textSecondary}
                value={sectionText}
                onChangeText={setSectionText}
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: isSubmitting ? colors.border : colors.primary }]}
                onPress={handleAdmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="school" size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>Confirm Admission</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
