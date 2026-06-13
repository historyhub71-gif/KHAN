import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { adminService } from '../../services/adminService';
import { feeService } from '../../services/feeService';
import { salaryService } from '../../services/salaryService';
import { supabase } from '../../utils/supabase';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface ReportSummary {
  totalTeachers: number;
  approvedTeachers: number;
  totalStudents: number;
  approvedStudents: number;
  totalCourses: number;
  feesPending: number;
  feesApprovedAmount: number;
  feesUnpaid: number;
  attendancePresentCount: number;
  attendanceAbsentCount: number;
  attendanceLateCount: number;
  salaryReports: Array<{
    teacher_name: string;
    month: number;
    year: number;
    base_salary: number;
    deduction_amount: number;
    final_salary: number;
  }>;
}

export default function AdminReportsScreen() {
  const { colors } = useTheme();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const generateReport = useCallback(async () => {
    try {
      setIsLoading(true);

      const startOfMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endOfMonth = new Date(selectedYear, selectedMonth, 0).toISOString().slice(0, 10);

      const [teachers, students, courses, feePending, feeApproved, feeUnpaid, attendance, salaryReps] = await Promise.all([
        adminService.getTeachers().catch(() => []),
        adminService.getStudents().catch(() => []),
        adminService.getCourses().catch(() => []),
        supabase.from('fee_payments').select('id').eq('status', 'pending').is('deleted_at', null)
          .gte('created_at', startOfMonth).lte('created_at', endOfMonth + 'T23:59:59'),
        supabase.from('fee_payments').select('amount').eq('status', 'approved').is('deleted_at', null)
          .gte('created_at', startOfMonth).lte('created_at', endOfMonth + 'T23:59:59'),
        supabase.from('fee_payments').select('id').eq('status', 'unpaid').is('deleted_at', null),
        supabase.from('teacher_attendance').select('status')
          .gte('date', startOfMonth).lte('date', endOfMonth),
        salaryService.getDeductionReports(selectedMonth, selectedYear).catch(() => []),
      ]);

      const approvedFeesTotal = feeApproved.data?.reduce((acc, f) => acc + Number(f.amount), 0) || 0;
      const attPresent = attendance.data?.filter((r) => r.status === 'present').length || 0;
      const attAbsent = attendance.data?.filter((r) => r.status === 'absent').length || 0;
      const attLate = attendance.data?.filter((r) => r.status === 'late').length || 0;

      setReport({
        totalTeachers: teachers.length,
        approvedTeachers: teachers.filter((t) => t.approved).length,
        totalStudents: students.length,
        approvedStudents: students.filter((s) => s.approved).length,
        totalCourses: courses.length,
        feesPending: feePending.data?.length || 0,
        feesApprovedAmount: approvedFeesTotal,
        feesUnpaid: feeUnpaid.data?.length || 0,
        attendancePresentCount: attPresent,
        attendanceAbsentCount: attAbsent,
        attendanceLateCount: attLate,
        salaryReports: (salaryReps || []).map((r: any) => ({
          teacher_name: r.teacher_name || 'Teacher',
          month: r.month,
          year: r.year,
          base_salary: Number(r.base_salary),
          deduction_amount: Number(r.deduction_amount),
          final_salary: Number(r.final_salary),
        })),
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate report');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [selectedMonth, selectedYear]);

  useFocusEffect(useCallback(() => { generateReport(); }, [generateReport]));
  const onRefresh = () => { setRefreshing(true); generateReport(); };

  const shiftMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
    setReport(null);
  };

  const formatCurrency = (n: number) => `Rs. ${n.toFixed(2)}`;
  const attendanceTotal = (report?.attendancePresentCount || 0) + (report?.attendanceAbsentCount || 0) + (report?.attendanceLateCount || 0);
  const attendanceRate = attendanceTotal > 0
    ? Math.round(((report?.attendancePresentCount || 0) / attendanceTotal) * 100)
    : 0;

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIconBg, { backgroundColor: colors.success + '15' }]}>
            <MaterialIcons name="assessment" size={28} color={colors.success} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Academic Reports</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Monthly system-wide status and analytics
            </Text>
          </View>
        </View>

        {/* Month Navigator */}
        <View style={[styles.monthNav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.monthNavBtn} activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={26} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: colors.text }]}>
            {MONTHS[selectedMonth - 1]} {selectedYear}
          </Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.monthNavBtn} activeOpacity={0.7}>
            <MaterialIcons name="chevron-right" size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Generating report...</Text>
          </View>
        ) : report ? (
          <>
            {/* Section: Platform Overview */}
            <SectionHeader label="Platform Overview" icon="dashboard" color={colors.primary} colors={colors} />
            <View style={styles.statsGrid}>
              <StatCard label="Total Teachers" value={String(report.totalTeachers)} sub={`${report.approvedTeachers} Approved`} color={colors.primary} colors={colors} icon="person" />
              <StatCard label="Total Students" value={String(report.totalStudents)} sub={`${report.approvedStudents} Approved`} color={colors.warning} colors={colors} icon="school" />
              <StatCard label="Active Courses" value={String(report.totalCourses)} sub="Running" color={colors.success} colors={colors} icon="class" />
            </View>

            {/* Section: Teacher Attendance */}
            <SectionHeader label="Teacher Attendance" icon="access-time" color={colors.warning} colors={colors} />
            <View style={[styles.attendanceBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.attendanceRateRow}>
                <Text style={[styles.attendanceRateVal, { color: colors.primary }]}>{attendanceRate}%</Text>
                <Text style={[styles.attendanceRateLabel, { color: colors.textSecondary }]}>Attendance Rate</Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                <View style={[styles.progressBarFill, { width: `${attendanceRate}%`, backgroundColor: colors.primary }]} />
              </View>
              <View style={styles.attendanceBreakdown}>
                <ABreakdown label="Present" count={report.attendancePresentCount} color={colors.success} />
                <ABreakdown label="Late" count={report.attendanceLateCount} color={colors.warning} />
                <ABreakdown label="Absent" count={report.attendanceAbsentCount} color={colors.danger} />
                <ABreakdown label="Total" count={attendanceTotal} color={colors.primary} />
              </View>
            </View>

            {/* Section: Fee Overview */}
            <SectionHeader label="Fee Overview" icon="monetization-on" color={colors.success} colors={colors} />
            <View style={styles.statsGrid}>
              <StatCard label="Fees Collected" value={formatCurrency(report.feesApprovedAmount)} sub="Approved this month" color={colors.success} colors={colors} icon="check-circle" />
              <StatCard label="Pending Review" value={String(report.feesPending)} sub="Awaiting admin" color={colors.primary} colors={colors} icon="pending" />
              <StatCard label="Unpaid / Overdue" value={String(report.feesUnpaid)} sub="Action required" color={colors.danger} colors={colors} icon="warning" />
            </View>

            {/* Section: Salary Reports */}
            <SectionHeader label={`Salary Reports – ${MONTHS[selectedMonth - 1]}`} icon="payment" color={colors.secondary} colors={colors} />
            {report.salaryReports.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialIcons name="info-outline" size={28} color={colors.textSecondary} />
                <Text style={[styles.emptyBoxText, { color: colors.textSecondary }]}>
                  No salary reports saved for this month yet. Go to Teacher Salaries to calculate and save them.
                </Text>
              </View>
            ) : (
              report.salaryReports.map((sr, i) => (
                <View key={i} style={[styles.salaryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.salaryAvatar, { backgroundColor: colors.secondary + '20' }]}>
                    <Text style={[styles.salaryAvatarText, { color: colors.secondary }]}>
                      {sr.teacher_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.salaryInfo}>
                    <Text style={[styles.salaryName, { color: colors.text }]} numberOfLines={1}>{sr.teacher_name}</Text>
                    <Text style={[styles.salaryMeta, { color: colors.textSecondary }]}>
                      Base: {formatCurrency(sr.base_salary)} · Deduction: {formatCurrency(sr.deduction_amount)}
                    </Text>
                  </View>
                  <Text style={[styles.salaryFinal, { color: colors.success }]}>{formatCurrency(sr.final_salary)}</Text>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function SectionHeader({ label, icon, color, colors }: { label: string; icon: any; color: string; colors: any }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={[styles.sectionIcon, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.sectionLabel, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

function StatCard({ label, value, sub, color, colors, icon }: { label: string; value: string; sub: string; color: string; colors: any; icon: any }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.statSub, { color: colors.textSecondary }]}>{sub}</Text>
    </View>
  );
}

function ABreakdown({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={styles.aBreakdown}>
      <Text style={[styles.aBreakdownCount, { color }]}>{count}</Text>
      <Text style={[styles.aBreakdownLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerIconBg: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 3 },
  subtitle: { fontSize: 13 },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    borderWidth: 1, marginBottom: 20, overflow: 'hidden',
  },
  monthNavBtn: { paddingHorizontal: 14, paddingVertical: 12 },
  monthText: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  loadingContainer: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, fontSize: 14 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 6 },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 16, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: '28%', borderRadius: 14, padding: 14,
    borderWidth: 1, alignItems: 'center',
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  statSub: { fontSize: 10, textAlign: 'center' },
  // Attendance Box
  attendanceBox: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20,
  },
  attendanceRateRow: { alignItems: 'center', marginBottom: 10 },
  attendanceRateVal: { fontSize: 36, fontWeight: '800' },
  attendanceRateLabel: { fontSize: 13, marginTop: 2 },
  progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  progressBarFill: { height: '100%', borderRadius: 4 },
  attendanceBreakdown: { flexDirection: 'row', justifyContent: 'space-around' },
  aBreakdown: { alignItems: 'center' },
  aBreakdownCount: { fontSize: 20, fontWeight: '800' },
  aBreakdownLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  // Empty box
  emptyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: 14, borderWidth: 1, marginBottom: 20,
  },
  emptyBoxText: { flex: 1, fontSize: 13 },
  // Salary Row
  salaryRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 14, borderWidth: 1, marginBottom: 10,
  },
  salaryAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  salaryAvatarText: { fontSize: 16, fontWeight: '700' },
  salaryInfo: { flex: 1 },
  salaryName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  salaryMeta: { fontSize: 11 },
  salaryFinal: { fontSize: 16, fontWeight: '800' },
});
