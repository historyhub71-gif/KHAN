import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
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

  const handleDelete = (userId: string) => {
    const isTeacher = activeTab === 'teachers';
    const roleLabel = isTeacher ? 'teacher' : 'ASR';
    
    Alert.alert(`Delete ${roleLabel.toUpperCase()}`, `Are you sure you want to delete this ${roleLabel}?`, [
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
    ]);
  };

  const handleApprove = async (userId: string) => {
    const isTeacher = activeTab === 'teachers';
    try {
      if (isTeacher) {
        await adminService.approveTeacher(userId);
      } else {
        await adminService.approveInterviewer(userId);
      }
      fetchData();
      Alert.alert('Success', `${isTeacher ? 'Teacher' : 'ASR'} approved successfully`);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', `Failed to approve ${isTeacher ? 'teacher' : 'ASR'}`);
    }
  };

  const handleReject = async (userId: string) => {
    const isTeacher = activeTab === 'teachers';
    const roleLabel = isTeacher ? 'teacher' : 'ASR';
    
    Alert.alert(`Reject ${isTeacher ? 'Teacher' : 'ASR'}`, `Are you sure you want to reject this ${roleLabel}? They will lose access to the system.`, [
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
    ]);
  };

  const currentUsers = activeTab === 'teachers' ? teachers : interviewers;

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'teachers', label: 'Teachers', count: teachers.filter(t => !t.approved).length },
    { key: 'interviewers', label: 'ASRs', count: interviewers.filter(i => !i.approved).length },
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
                <Text style={[styles.tabBtnText, { color: activeTab === t.key ? colors.primary : colors.textSecondary }]}>
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
        />
      </View>
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
});
