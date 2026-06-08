import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { AttendanceHistoryByDate } from '../../types';
import { EmptyState } from '../common/EmptyState';

interface AttendanceHistoryByDateProps {
  history: AttendanceHistoryByDate[];
  onDelete?: (date: string) => void;
}

export const AttendanceHistoryByDateList: React.FC<AttendanceHistoryByDateProps> = ({
  history,
  onDelete,
}) => {
  const { colors } = useTheme();

  const formatLogDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

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
          <View style={styles.dateRowContainer}>
            {onDelete && (
              <TouchableOpacity
                onPress={() => onDelete(day.date)}
                style={styles.deleteBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            )}
            <Text style={[styles.date, { color: colors.text }]}>
              {formatLogDate(day.date)}
            </Text>
          </View>
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
  dateRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    padding: 4,
    marginRight: 2,
    justifyContent: 'center',
    alignItems: 'center',
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
