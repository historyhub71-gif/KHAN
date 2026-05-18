import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { StudentGlobalAttendance } from '../../types';
import { ProgressBar } from '../common/ProgressBar';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface StudentOverviewCardProps {
  overview: StudentGlobalAttendance | null;
  isLoading: boolean;
}

export const StudentOverviewCard: React.FC<StudentOverviewCardProps> = ({
  overview,
  isLoading,
}) => {
  const { colors } = useTheme();

  if (isLoading && !overview) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LoadingSpinner />
      </View>
    );
  }

  if (!overview) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <MaterialIcons name="insights" size={22} color={colors.secondary} />
        <Text style={[styles.title, { color: colors.text }]}>Your Attendance</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.success }]}>{overview.totalPresent}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Present</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.danger }]}>{overview.totalAbsent}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Absent</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{overview.percentage}%</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rate</Text>
        </View>
      </View>
      <ProgressBar percentage={overview.percentage} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
