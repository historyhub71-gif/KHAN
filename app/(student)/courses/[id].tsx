import { useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { ScreenContainer } from '../../../component/common/ScreenContainer';
import { AttendanceCalendar } from '../../../component/student/AttendanceCalendar';
import { AttendanceStatsComponent } from '../../../component/student/AttendanceStats';
import { useAttendance } from '../../../hooks/useAttendance';
import { useAuth } from '../../../hooks/useAuth';
import { teacherService } from '../../../services/teacherService';
import { useTheme } from '../../../context/ThemeContext';

export default function CourseAttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [courseName, setCourseName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const { user } = useAuth();
  const { fetchStats, fetchMonthlyAttendance, stats, isLoading, attendance } = useAttendance();

  useFocusEffect(
    useCallback(() => {
      if (id && user?.id) {
        fetchData();
      }
    }, [id, user?.id])
  );

  const fetchData = async () => {
    try {
      if (!id || !user?.id) return;

      // Fetch course name
      const course = await teacherService.getCourse(id);
      setCourseName(course.name);

      // Fetch stats
      await fetchStats(user.id, id);

      // Fetch current month attendance
      const now = new Date();
      await fetchMonthlyAttendance(
        user.id,
        id,
        now.getFullYear(),
        now.getMonth()
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load attendance data');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleMonthChange = async (year: number, month: number) => {
    if (!id || !user?.id) return;
    try {
      await fetchMonthlyAttendance(user.id, id, year, month);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView 
        style={styles.scroll} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.courseName, { color: colors.text }]}>{courseName}</Text>
        </View>

        <AttendanceStatsComponent stats={stats} isLoading={isLoading} />

        <View style={styles.calendarContainer}>
          <AttendanceCalendar
            attendance={attendance}
            courseId={id || ''}
            onMonthChange={handleMonthChange}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  courseName: {
    fontSize: 20,
    fontWeight: '700',
  },
  calendarContainer: {
    flex: 1,
  },
});
