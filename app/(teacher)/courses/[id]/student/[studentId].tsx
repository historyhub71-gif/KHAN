import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '../../../../../component/common/ScreenContainer';
import { LoadingSpinner } from '../../../../../component/common/LoadingSpinner';
import { AttendanceReportPanel } from '../../../../../component/teacher/AttendanceReportPanel';
import { useAuth } from '../../../../../hooks/useAuth';
import { useAttendanceReport } from '../../../../../hooks/useAttendanceReport';
import { useTheme } from '../../../../../context/ThemeContext';

export default function StudentReportScreen() {
  const { id: courseId, studentId } = useLocalSearchParams<{
    id: string;
    studentId: string;
  }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const {
    report,
    isLoading,
    isExporting,
    error,
    loadReport,
    downloadPdf,
    shareToParent,
  } = useAttendanceReport(user?.id, courseId, studentId);

  useEffect(() => {
    if (user?.role !== 'teacher') {
      router.replace('/(auth)/login');
      return;
    }
    loadReport();
  }, [user?.role, loadReport]);

  const studentName = report?.student.name ?? 'Student';
  const courseLabel = report
    ? `${report.course.name} (${report.course.code})`
    : '';

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && !isExporting}
            onRefresh={loadReport}
          />
        }
      >
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            <MaterialIcons name="person" size={32} color={colors.primary} />
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.name, { color: colors.text }]}>{studentName}</Text>
            {report?.student.email ? (
              <Text style={[styles.email, { color: colors.textSecondary }]}>
                {report.student.email}
              </Text>
            ) : null}
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              ID: {studentId?.slice(0, 8).toUpperCase()}
            </Text>
            {courseLabel ? (
              <Text style={[styles.meta, { color: colors.primary }]}>{courseLabel}</Text>
            ) : null}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Attendance report</Text>

        {isLoading && !report ? (
          <LoadingSpinner />
        ) : (
          <AttendanceReportPanel
            report={report}
            isLoading={false}
            isExporting={isExporting}
            error={error}
            onDownload={downloadPdf}
            onShare={shareToParent}
          />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
});
