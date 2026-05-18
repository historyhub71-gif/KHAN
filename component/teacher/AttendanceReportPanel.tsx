import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { StudentAttendanceReport } from '../../types';
import { FREQUENT_ABSENT_THRESHOLD } from '../../utils/constants';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ProgressBar } from '../common/ProgressBar';
import { StatCard } from '../common/StatCard';

interface AttendanceReportPanelProps {
  report: StudentAttendanceReport | null;
  isLoading: boolean;
  isExporting: boolean;
  error: string | null;
  onDownload: () => void;
  onShare: () => void;
}

export const AttendanceReportPanel: React.FC<AttendanceReportPanelProps> = ({
  report,
  isLoading,
  isExporting,
  error,
  onDownload,
  onShare,
}) => {
  const { colors } = useTheme();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!report) {
    return error ? (
      <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
    ) : null;
  }

  return (
    <View style={styles.wrap}>
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}

      {report.frequentAbsentWarning && (
        <View style={[styles.warning, { backgroundColor: colors.warning + '22', borderColor: colors.warning }]}>
          <MaterialIcons name="warning" size={20} color={colors.warning} />
          <Text style={[styles.warningText, { color: colors.text }]}>
            Frequent absences: {report.stats.absent} days (threshold {FREQUENT_ABSENT_THRESHOLD}+)
          </Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <StatCard icon="percent" label="Rate" value={`${report.stats.percentage}%`} />
        <StatCard icon="check-circle" label="Present" value={report.stats.present} color={colors.success} />
        <StatCard icon="cancel" label="Absent" value={report.stats.absent} color={colors.danger} />
      </View>

      <Text style={[styles.chartTitle, { color: colors.text }]}>Attendance overview</Text>
      <ProgressBar percentage={report.stats.percentage} />

      {report.monthlySummaries.length > 0 && (
        <View style={[styles.monthlyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.monthlyTitle, { color: colors.text }]}>Monthly summary</Text>
          {report.monthlySummaries.slice(0, 4).map((m) => (
            <View key={m.month} style={styles.monthlyRow}>
              <Text style={[styles.monthLabel, { color: colors.textSecondary }]}>{m.month}</Text>
              <Text style={[styles.monthVal, { color: colors.text }]}>
                {m.percentage}% · P{m.present} A{m.absent}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Button
        title="Download PDF Report"
        onPress={onDownload}
        loading={isExporting}
        fullWidth
        style={styles.btn}
      />
      <Button
        title="Share to Parent"
        onPress={onShare}
        loading={isExporting}
        variant="secondary"
        fullWidth
        style={styles.btn}
      />
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Share via WhatsApp, Gmail, Messenger, or any app on your phone.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  monthlyBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 16,
  },
  monthlyTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  monthlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  monthLabel: {
    fontSize: 12,
  },
  monthVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  btn: {
    marginTop: 8,
  },
  hint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
});
