import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    StyleSheet,
    View
} from 'react-native';
import { UserList } from '../../component/admin/UserList';
import { Button } from '../../component/common/Button';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { adminService } from '../../services/adminService';
import { Profile } from '../../types';

export default function TeachersScreen() {
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTeachers = useCallback(async () => {
    try {
      if (teachers.length === 0) {
        setIsLoading(true);
      }
      const data = await adminService.getTeachers();
      setTeachers(data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load teachers');
    } finally {
      setIsLoading(false);
    }
  }, [teachers.length]);

  useFocusEffect(
    useCallback(() => {
      fetchTeachers();
    }, [fetchTeachers])
  );

  const handleDelete = (teacherId: string) => {
    Alert.alert('Delete Teacher', 'Are you sure you want to delete this teacher?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminService.deleteTeacher(teacherId);
            fetchTeachers();
            Alert.alert('Success', 'Teacher deleted successfully');
          } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to delete teacher');
          }
        },
      },
    ]);
  };

  const handleApprove = async (teacherId: string) => {
    try {
      await adminService.approveTeacher(teacherId);
      fetchTeachers();
      Alert.alert('Success', 'Teacher approved successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to approve teacher');
    }
  };

  const handleReject = async (teacherId: string) => {
    Alert.alert('Reject Teacher', 'Are you sure you want to reject this teacher? They will lose access to the system.', [
      { text: 'Cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminService.rejectTeacher(teacherId);
            fetchTeachers();
            Alert.alert('Success', 'Teacher rejected successfully');
          } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to reject teacher');
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Button
          title="Refresh"
          onPress={fetchTeachers}
          fullWidth
          size="small"
          style={styles.refreshButton}
        />
        <UserList
          users={teachers}
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
  },
});
