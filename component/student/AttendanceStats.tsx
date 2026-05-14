import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AttendanceStats } from '../../types';
import { Colors } from '../../utils/colors';

interface AttendanceStatsProps {
  stats: AttendanceStats | null;
  isLoading?: boolean;
}

export const AttendanceStatsComponent: React.FC<AttendanceStatsProps> = ({
  stats,
  isLoading,
}) => {
  if (!stats) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.stat}>
        <Text style={styles.statLabel}>Total Classes</Text>
        <Text style={styles.statValue}>{stats.total}</Text>
      </View>

      <View style={[styles.stat, styles.presentStat]}>
        <Text style={styles.statLabel}>Present</Text>
        <Text style={[styles.statValue, { color: Colors.success }]}>
          {stats.present}
        </Text>
      </View>

      <View style={[styles.stat, styles.absentStat]}>
        <Text style={styles.statLabel}>Absent</Text>
        <Text style={[styles.statValue, { color: Colors.danger }]}>
          {stats.absent}
        </Text>
      </View>

      <View style={[styles.stat, styles.percentageStat]}>
        <Text style={styles.statLabel}>Attendance %</Text>
        <Text style={[styles.statValue, styles.percentageValue]}>
          {stats.percentage}%
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  stat: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    alignItems: 'center',
  },
  presentStat: {
    borderColor: Colors.success,
    borderWidth: 2,
  },
  absentStat: {
    borderColor: Colors.danger,
    borderWidth: 2,
  },
  percentageStat: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.gray,
    marginBottom: 8,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark,
  },
  percentageValue: {
    color: Colors.primary,
  },
});
