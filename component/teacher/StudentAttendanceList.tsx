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
import { useTheme } from '../../context/ThemeContext';
import { EmptyState } from '../common/EmptyState';

interface StudentAttendanceListProps {
  students: Profile[];
  isLoading: boolean;
  existingAttendance: { [studentId: string]: 'present' | 'absent' };
  onSubmitAll: (attendanceMap: { [studentId: string]: 'present' | 'absent' }) => void;
  isSubmitting: boolean;
  onOpenReport?: (student: Profile) => void;
}

export const StudentAttendanceList: React.FC<StudentAttendanceListProps> = ({
  students,
  isLoading,
  existingAttendance,
  onSubmitAll,
  isSubmitting,
  onOpenReport,
}) => {
  const [attendance, setAttendance] = useState<{ [studentId: string]: 'present' | 'absent' | null }>({});
  const { colors } = useTheme();

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
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.studentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.studentHeader}>
              <Text style={[styles.studentName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.studentEmail, { color: colors.textSecondary }]}>{item.email}</Text>
            </View>

            <View style={styles.buttonRow}>
              {onOpenReport ? (
                <TouchableOpacity
                  style={[styles.pdfButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => onOpenReport(item)}
                  accessibilityLabel="Download PDF report"
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="picture-as-pdf" size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  attendance[item.id] === 'present' && {
                    backgroundColor: colors.success + '12',
                    borderColor: colors.success,
                  },
                ]}
                onPress={() => handleStatusChange(item.id, 'present')}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={attendance[item.id] === 'present' ? 'check-circle' : 'radio-button-unchecked'}
                  size={18}
                  color={attendance[item.id] === 'present' ? colors.success : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.attendanceButtonText,
                    { color: colors.textSecondary },
                    attendance[item.id] === 'present' && {
                      color: colors.success,
                      fontWeight: '700',
                    },
                  ]}
                >
                  Present
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  attendance[item.id] === 'absent' && {
                    backgroundColor: colors.danger + '12',
                    borderColor: colors.danger,
                  },
                ]}
                onPress={() => handleStatusChange(item.id, 'absent')}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={attendance[item.id] === 'absent' ? 'cancel' : 'radio-button-unchecked'}
                  size={18}
                  color={attendance[item.id] === 'absent' ? colors.danger : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.attendanceButtonText,
                    { color: colors.textSecondary },
                    attendance[item.id] === 'absent' && {
                      color: colors.danger,
                      fontWeight: '700',
                    },
                  ]}
                >
                  Absent
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
      />

      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: colors.primary },
          isSubmitting && { backgroundColor: colors.gray },
          { shadowColor: colors.primary }
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.8}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <>
            <MaterialIcons name="check-circle" size={20} color={colors.white} />
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
    paddingBottom: 24,
  },
  studentCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    // Premium soft shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  studentHeader: {
    marginBottom: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    width: '100%',
  },
  pdfButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendanceButton: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  attendanceButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    marginHorizontal: 16,
    marginBottom: 20,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
