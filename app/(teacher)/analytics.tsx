import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { LoadingSpinner } from '../../component/common/LoadingSpinner';
import { StatCard } from '../../component/common/StatCard';
import { AnalyticsSummary } from '../../component/teacher/AnalyticsSummary';
import { AttendanceHistoryByDateList } from '../../component/teacher/AttendanceHistoryByDate';
import { FrequentAbsenteesList } from '../../component/teacher/FrequentAbsenteesList';
import { StudentAnalyticsList } from '../../component/teacher/StudentAnalyticsList';
import { useAuth } from '../../hooks/useAuth';
import { useTeacherAnalytics } from '../../hooks/useTeacherAnalytics';
import { useTheme } from '../../context/ThemeContext';

export default function TeacherAnalyticsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const {
    courses,
    selectedCourseId,
    dailyStats,
    studentAnalytics,
    frequentAbsentees,
    historyByDate,
    isLoading,
    error,
    fetchCourses,
    fetchAnalytics,
    selectCourse,
  } = useTeacherAnalytics(user?.id);

  const [refreshing, setRefreshing] = React.useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchCourses();
      }
    }, [user?.id, fetchCourses])
  );

  useEffect(() => {
    if (selectedCourseId) {
      fetchAnalytics(selectedCourseId);
    }
  }, [selectedCourseId, fetchAnalytics]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCourses();
    if (selectedCourseId) {
      await fetchAnalytics(selectedCourseId);
    }
    setRefreshing(false);
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={[styles.pageTitle, { color: colors.text }]}>Analytics</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coursePicker}>
          {courses.map((course) => {
            const active = course.id === selectedCourseId;
            return (
              <TouchableOpacity
                key={course.id}
                style={[
                  styles.courseChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => selectCourse(course.id)}
              >
                <Text
                  style={[
                    styles.courseChipText,
                    { color: active ? colors.white : colors.text },
                  ]}
                >
                  {course.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.danger + '15' }]}>
            <MaterialIcons name="error-outline" size={20} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        {isLoading && !dailyStats ? (
          <LoadingSpinner />
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Today — {selectedCourse?.name ?? 'Course'}
            </Text>
            <AnalyticsSummary stats={dailyStats} />
            {dailyStats && (
              <View style={styles.rateRow}>
                <StatCard
                  icon="percent"
                  label="Today's rate"
                  value={`${dailyStats.attendanceRateToday}%`}
                />
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Student attendance</Text>
            <StudentAnalyticsList students={studentAnalytics} />

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Frequently absent</Text>
            <FrequentAbsenteesList students={frequentAbsentees} />

            <Text style={[styles.sectionTitle, { color: colors.text }]}>History by date</Text>
            <AttendanceHistoryByDateList history={historyByDate} />
          </>
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
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  coursePicker: {
    marginBottom: 20,
    maxHeight: 44,
  },
  courseChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  courseChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  rateRow: {
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
});
