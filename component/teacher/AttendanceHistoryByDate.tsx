import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { AttendanceHistoryByDate } from '../../types';
import { EmptyState } from '../common/EmptyState';

interface AttendanceHistoryByDateProps {
  history: AttendanceHistoryByDate[];
}

export const AttendanceHistoryByDateList: React.FC<AttendanceHistoryByDateProps> = ({
  history,
}) => {
  const { colors } = useTheme();

  if (history.length === 0) {
    return (
      <EmptyState
        icon="history"
        title="No history"
        message="Attendance history will appear after you mark sessions."
      />
    );
  }

  return (
    <View style={styles.list}>
      {history.map((day) => (
        <View
          key={day.date}
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.date, { color: colors.text }]}>{day.date}</Text>
          <View style={styles.badges}>
            <Text style={[styles.present, { color: colors.success }]}>
              {day.present} present
            </Text>
            <Text style={[styles.absent, { color: colors.danger }]}>
              {day.absent} absent
            </Text>
          </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  date: {
    fontSize: 14,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    gap: 12,
  },
  present: {
    fontSize: 12,
    fontWeight: '700',
  },
  absent: {
    fontSize: 12,
    fontWeight: '700',
  },
});
