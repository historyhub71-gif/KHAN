import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Profile } from '../../types';
import { Colors } from '../../utils/colors';
import { EmptyState } from '../common/EmptyState';

interface StudentAttendanceListProps {
  students: Profile[];
  isLoading: boolean;
  existingAttendance: { [studentId: string]: 'present' | 'absent' };
  onSubmitAll: (attendanceMap: { [studentId: string]: 'present' | 'absent' }) => void;
  isSubmitting: boolean;
}

export const StudentAttendanceList: React.FC<StudentAttendanceListProps> = ({
  students,
  isLoading,
  existingAttendance,
  onSubmitAll,
  isSubmitting,
}) => {
  const [attendance, setAttendance] = useState<{ [studentId: string]: 'present' | 'absent' | null }>({});

  useEffect(() => {
    // Initialize with existing attendance
    const initial: { [studentId: string]: 'present' | 'absent' | null } = {};
    Object.assign(initial, existingAttendance);
    students.forEach(student => {
      if (!(student.id in initial)) {
        initial[student.id] = null;
      }
    });
    setAttendance(initial);
  }, [students, existingAttendance]);

  const handleStatusChange = (studentId: string, status: 'present' | 'absent') => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSubmit = () => {
    const filteredAttendance = Object.fromEntries(
      Object.entries(attendance).filter(([_, status]) => status !== null)
    ) as { [studentId: string]: 'present' | 'absent' };
    onSubmitAll(filteredAttendance);
  };

  const isUpdate = Object.keys(existingAttendance).length > 0;

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (students.length === 0) {
    return (
      <EmptyState title="No Students" message="No students enrolled in this course" />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.studentCard}>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={styles.studentEmail}>{item.email}</Text>
            </View>

            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[
                  styles.radioButton,
                  attendance[item.id] === 'present' && styles.radioSelected,
                ]}
                onPress={() => handleStatusChange(item.id, 'present')}
              >
                <MaterialIcons
                  name={attendance[item.id] === 'present' ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={20}
                  color={attendance[item.id] === 'present' ? Colors.success : Colors.gray}
                />
                <Text style={[
                  styles.radioText,
                  attendance[item.id] === 'present' && styles.radioTextSelected,
                ]}>
                  Present
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.radioButton,
                  attendance[item.id] === 'absent' && styles.radioSelected,
                ]}
                onPress={() => handleStatusChange(item.id, 'absent')}
              >
                <MaterialIcons
                  name={attendance[item.id] === 'absent' ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={20}
                  color={attendance[item.id] === 'absent' ? Colors.danger : Colors.gray}
                />
                <Text style={[
                  styles.radioText,
                  attendance[item.id] === 'absent' && styles.radioTextSelected,
                ]}>
                  Absent
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
      />

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <>
            <MaterialIcons name="check-circle" size={20} color={Colors.white} />
            <Text style={styles.submitButtonText}>
              {isUpdate ? 'Update Attendance' : 'Submit Attendance'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  studentCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark,
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 14,
    color: Colors.gray,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  radioSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.light,
  },
  radioText: {
    fontSize: 14,
    color: Colors.gray,
    marginLeft: 8,
  },
  radioTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.gray,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
