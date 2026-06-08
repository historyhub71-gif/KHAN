import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    StyleSheet,
    View,
} from 'react-native';
import { UserList } from '../../component/admin/UserList';
import { Button } from '../../component/common/Button';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { adminService } from '../../services/adminService';
import { Profile } from '../../types';

export default function StudentsScreen() {
  const [students, setStudents] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStudents = useCallback(async () => {
    try {
      if (students.length === 0) {
        setIsLoading(true);
      }
      const data = await adminService.getStudents();
      setStudents(data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  }, [students.length]);

  useFocusEffect(
    useCallback(() => {
      fetchStudents();
    }, [fetchStudents])
  );

  const handleDelete = (studentId: string) => {
    Alert.alert('Delete Student', 'Are you sure you want to delete this student?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminService.deleteStudent(studentId);
            fetchStudents();
            Alert.alert('Success', 'Student deleted successfully');
          } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to delete student');
          }
        },
      },
    ]);
  };

  const handleApprove = async (studentId: string) => {
    try {
      await adminService.approveStudent(studentId);
      fetchStudents();
      Alert.alert('Success', 'Student approved successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to approve student');
    }
  };

  const handleReject = async (studentId: string) => {
    Alert.alert('Reject Student', 'Are you sure you want to reject this student? They will lose access to the system.', [
      { text: 'Cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminService.rejectStudent(studentId);
            fetchStudents();
            Alert.alert('Success', 'Student rejected successfully');
          } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to reject student');
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
          onPress={fetchStudents}
          fullWidth
          size="small"
          style={styles.refreshButton}
        />
        <UserList
          users={students}
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
