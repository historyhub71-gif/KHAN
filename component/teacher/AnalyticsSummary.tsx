import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TeacherDailyAnalytics } from '../../types';
import { StatCard } from '../common/StatCard';

interface AnalyticsSummaryProps {
  stats: TeacherDailyAnalytics | null;
}

export const AnalyticsSummary: React.FC<AnalyticsSummaryProps> = ({ stats }) => {
  const data = stats || { totalStudents: 0, presentToday: 0, absentToday: 0 };

  return (
    <View style={styles.row}>
      <StatCard icon="groups" label="Students" value={data.totalStudents} />
      <StatCard icon="check-circle" label="Present" value={data.presentToday} color="#34C759" />
      <StatCard icon="cancel" label="Absent" value={data.absentToday} color="#FF3B30" />
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
