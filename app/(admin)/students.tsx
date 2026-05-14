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

  useFocusEffect(
    useCallback(() => {
      fetchStudents();
    }, [])
  );

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getStudents();
      setStudents(data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
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
            fetchStudents();
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
      fetchStudents();
      Alert.alert('Success', 'Student approved successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to approve student');
    }
  };

  const handleDisapprove = async (studentId: string) => {
    Alert.alert('Disapprove Student', 'Are you sure you want to disapprove this student? They will lose access to the system.', [
      { text: 'Cancel' },
      {
        text: 'Disapprove',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminService.disapproveStudent(studentId);
            fetchStudents();
            Alert.alert('Success', 'Student disapproved successfully');
          } catch (err) {
            Alert.alert('Error', 'Failed to disapprove student');
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
          onDisapprovePress={handleDisapprove}
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
