import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TeacherDailyAnalytics } from '../../types';
import { StatCard } from '../common/StatCard';

interface AnalyticsSummaryProps {
  stats: TeacherDailyAnalytics | null;
}

export const AnalyticsSummary: React.FC<AnalyticsSummaryProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <View style={styles.row}>
      <StatCard icon="groups" label="Students" value={stats.totalStudents} />
      <StatCard icon="check-circle" label="Present" value={stats.presentToday} color="#34C759" />
      <StatCard icon="cancel" label="Absent" value={stats.absentToday} color="#FF3B30" />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
});
