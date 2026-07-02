import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { UserList } from '../../component/admin/UserList';
import { Button } from '../../component/common/Button';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { adminService } from '../../services/adminService';
import { Profile } from '../../types';

type TabKey = 'teachers' | 'interviewers';

export default function TeachersScreen() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('teachers');
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [interviewers, setInterviewers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'approve' | 'edit'>('approve');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [checkInTime, setCheckInTime] = useState('09:00 AM');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [teachersData, interviewersData] = await Promise.all([
        adminService.getTeachers().catch(() => []),
        adminService.getInterviewers().catch(() => []),
      ]);
      setTeachers(teachersData);
      setInterviewers(interviewersData);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load staff profiles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // ─── Validate time format "HH:MM AM/PM" ───────────────────────────────────
  const isValidTime = (value: string) => {
    return /^\d{2}:\d{2}\s?(AM|PM)$/i.test(value.trim());
  };

  // ─── Open "Approve & Set Time" modal ─────────────────────────────────────
  const handleSetTimePress = (user: Profile) => {
    setSelectedUser(user);
    if (user.approved) {
      setModalMode('edit');
      setCheckInTime(user.official_check_in_time || '09:00 AM');
    } else {
      setModalMode('approve');
      setCheckInTime('09:00 AM');
    }
    setModalVisible(true);
  };

  // ─── Submit modal ─────────────────────────────────────────────────────────
  const handleModalSubmit = async () => {
    if (!selectedUser) return;
    const trimmedTime = checkInTime.trim();

    if (!isValidTime(trimmedTime)) {
      Alert.alert(
        'Invalid Format',
        'Please enter time in HH:MM AM or HH:MM PM format.\nExample: 09:00 AM'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      if (modalMode === 'approve') {
        await adminService.approveTeacher(selectedUser.id, trimmedTime);
        Alert.alert(
          'Teacher Approved ✓',
          `${selectedUser.name} has been approved.\nOfficial check-in time set to ${trimmedTime}.`
        );
      } else {
        await adminService.updateTeacherCheckInTime(selectedUser.id, trimmedTime);
        Alert.alert(
          'Time Updated ✓',
          `Official check-in time for ${selectedUser.name} updated to ${trimmedTime}.`
        );
      }
      setModalVisible(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Failed to save changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = (userId: string) => {
    const isTeacher = activeTab === 'teachers';
    const roleLabel = isTeacher ? 'teacher' : 'ASR';

    Alert.alert(
      `Delete ${roleLabel.toUpperCase()}`,
      `Are you sure you want to delete this ${roleLabel}?`,
      [
        { text: 'Cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isTeacher) {
                await adminService.deleteTeacher(userId);
              } else {
                await adminService.deleteInterviewer(userId);
              }
              fetchData();
              Alert.alert('Success', `${isTeacher ? 'Teacher' : 'ASR'} deleted successfully`);
            } catch (err) {
              console.error(err);
              Alert.alert('Error', `Failed to delete ${roleLabel}`);
            }
          },
        },
      ]
    );
  };

  // ─── Approve (for interviewers — no time needed) ──────────────────────────
  const handleApprove = async (userId: string) => {
    if (activeTab === 'teachers') {
      // Teachers always go through the modal
      const teacher = teachers.find((t) => t.id === userId);
      if (teacher) handleSetTimePress(teacher);
      return;
    }
    try {
      await adminService.approveInterviewer(userId);
      fetchData();
      Alert.alert('Success', 'ASR approved successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to approve ASR');
    }
  };

  // ─── Reject ───────────────────────────────────────────────────────────────
  const handleReject = async (userId: string) => {
    const isTeacher = activeTab === 'teachers';
    const roleLabel = isTeacher ? 'teacher' : 'ASR';

    Alert.alert(
      `Reject ${isTeacher ? 'Teacher' : 'ASR'}`,
      `Are you sure you want to reject this ${roleLabel}? They will lose access to the system.`,
      [
        { text: 'Cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isTeacher) {
                await adminService.rejectTeacher(userId);
              } else {
                await adminService.rejectInterviewer(userId);
              }
              fetchData();
              Alert.alert('Success', `${isTeacher ? 'Teacher' : 'ASR'} rejected successfully`);
            } catch (err) {
              console.error(err);
              Alert.alert('Error', `Failed to reject ${roleLabel}`);
            }
          },
        },
      ]
    );
  };

  const currentUsers = activeTab === 'teachers' ? teachers : interviewers;

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'teachers', label: 'Teachers', count: teachers.filter((t) => !t.approved).length },
    { key: 'interviewers', label: 'ASRs', count: interviewers.filter((i) => !i.approved).length },
  ];

  return (
    <ScreenContainer>
      <View style={styles.container}>
        {/* Tab switcher */}
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tabBtn,
                activeTab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
              ]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.7}
            >
              <View style={styles.tabBtnContent}>
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === t.key ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {t.label}
                </Text>
                {t.count > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                    <Text style={styles.badgeText}>{t.count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title="Refresh"
          onPress={fetchData}
          fullWidth
          size="small"
          style={styles.refreshButton}
        />

        <UserList
          users={currentUsers}
          isLoading={isLoading}
          onDeletePress={handleDelete}
          onApprovePress={handleApprove}
          onRejectPress={handleReject}
          onSetTimePress={activeTab === 'teachers' ? handleSetTimePress : undefined}
        />
      </View>

      {/* ── Approve & Set Time / Edit Time Modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconCircle, { backgroundColor: colors.primary + '15' }]}>
                <MaterialIcons name="schedule" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {modalMode === 'approve' ? 'Approve & Set Time' : 'Edit Check-In Time'}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                {modalMode === 'approve'
                  ? `Set the official check-in deadline for ${selectedUser?.name ?? 'this teacher'}.`
                  : `Update the official check-in time for ${selectedUser?.name ?? 'this teacher'}.`}
              </Text>
            </View>

            {/* Time Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Official Check-In Time
              </Text>
              <View
                style={[
                  styles.timeInputWrapper,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <MaterialIcons name="access-time" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.timeInput, { color: colors.text }]}
                  value={checkInTime}
                  onChangeText={setCheckInTime}
                  placeholder="09:00 AM"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  returnKeyType="done"
                />
              </View>
              <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                Format: HH:MM AM or HH:MM PM &nbsp;(e.g. 09:00 AM, 08:30 AM)
              </Text>

              {/* Quick select buttons */}
              <View style={styles.quickButtons}>
                {['08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.quickChip,
                      {
                        backgroundColor: checkInTime === t ? colors.primary : colors.background,
                        borderColor: checkInTime === t ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setCheckInTime(t)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        { color: checkInTime === t ? '#fff' : colors.textSecondary },
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.6 : 1 }]}
                onPress={handleModalSubmit}
                disabled={isSubmitting}
              >
                <MaterialIcons
                  name={modalMode === 'approve' ? 'check-circle' : 'save'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.confirmBtnText}>
                  {isSubmitting ? 'Saving...' : modalMode === 'approve' ? 'Approve' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  refreshButton: {
    padding: 2,
    marginBottom: 10,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  timeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  timeInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  inputHint: {
    fontSize: 11,
    marginBottom: 14,
  },
  quickButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
