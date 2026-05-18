import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { StudentCourseAnalytics } from '../../types';
import { ProgressBar } from '../common/ProgressBar';
import { EmptyState } from '../common/EmptyState';

interface StudentAnalyticsListProps {
  students: StudentCourseAnalytics[];
}

export const StudentAnalyticsList: React.FC<StudentAnalyticsListProps> = ({
  students,
}) => {
  const { colors } = useTheme();

  if (students.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="No students"
        message="No students enrolled in this course yet."
      />
    );
  }

  const sorted = [...students].sort((a, b) => b.percentage - a.percentage);

  return (
    <View style={styles.list}>
      {sorted.map((item) => (
        <View
          key={item.student.id}
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.top}>
            <Text style={[styles.name, { color: colors.text }]}>{item.student.name}</Text>
            <Text style={[styles.counts, { color: colors.textSecondary }]}>
              P:{item.present} · A:{item.absent}
            </Text>
          </View>
          <ProgressBar percentage={item.percentage} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  row: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  counts: {
    fontSize: 12,
    fontWeight: '600',
  },
});
