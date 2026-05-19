import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { StudentCourseAnalytics } from '../../types';
import { FREQUENT_ABSENT_THRESHOLD } from '../../utils/constants';

interface FrequentAbsenteesListProps {
  students: StudentCourseAnalytics[];
  /** Called with student.id when teacher dismisses that card */
  onDismiss?: (studentId: string) => void;
}

export const FrequentAbsenteesList: React.FC<FrequentAbsenteesListProps> = ({
  students,
  onDismiss,
}) => {
  const { colors } = useTheme();

  if (students.length === 0) {
    return null; // section hidden when no flagged students remain
  }

  return (
    <View style={styles.list}>
      {students.map((item) => (
        <View
          key={item.student.id}
          style={[
            styles.row,
            { backgroundColor: colors.danger + '12', borderColor: colors.danger + '40' },
          ]}
        >
          <MaterialIcons name="warning" size={20} color={colors.danger} />
          <View style={styles.content}>
            <Text style={[styles.name, { color: colors.text }]}>
              {item.student.name}
            </Text>
            <Text style={[styles.detail, { color: colors.textSecondary }]}>
              {item.absent} absences · {item.percentage}% attendance
            </Text>
          </View>
          {onDismiss && (
            <TouchableOpacity
              onPress={() => onDismiss(item.student.id)}
              style={styles.deleteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="delete-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
  },
  detail: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 4,
  },
});
