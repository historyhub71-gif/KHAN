import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '../../../component/common/ScreenContainer';
import { StudentAttendanceList } from '../../../component/teacher/StudentAttendanceList';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../hooks/useAuth';
import { teacherService } from '../../../services/teacherService';
import { Profile } from '../../../types';
import { DateHelpers } from '../../../utils/dateHelpers';

export default function CourseAttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [existingAttendance, setExistingAttendance] = useState<{ [studentId: string]: 'present' | 'absent' | null }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courseName, setCourseName] = useState('');
  const { colors } = useTheme();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const today = DateHelpers.formatISO(new Date());

      const [courseData, studentsData, attendanceData] = await Promise.all([
        teacherService.getCourse(id!),
        teacherService.getCourseStudents(id!),
        teacherService.getAttendanceByDate(id!, today),
      ]);

      setCourseName(courseData.name);
      setStudents(studentsData);

      // Create attendance map
      const attendanceMap: { [studentId: string]: 'present' | 'absent' | null } = {};
      attendanceData.forEach((record: any) => {
        attendanceMap[record.student_id] = record.status;
      });
      setExistingAttendance(attendanceMap);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load course data');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, fetchData]);

  const handleSubmitAttendance = async (attendanceMap: { [studentId: string]: 'present' | 'absent' | null }) => {
    if (!user?.id || !id) return;

    try {
      setIsSubmitting(true);
      const today = DateHelpers.formatISO(new Date());

      await Promise.all(
        Object.entries(attendanceMap).map(([studentId, status]) =>
          teacherService.markAttendance(id, studentId, status, today, user.id)
        )
      );

      const absentCount = Object.values(attendanceMap).filter((s) => s === 'absent').length;
      const message =
        absentCount > 0
          ? `Attendance saved. ${absentCount} absent student(s) will be notified.`
          : 'Attendance submitted successfully';
      Alert.alert('Success', message);

      // Refresh data to show updated attendance
      await fetchData();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Failed to submit attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.courseName, { color: colors.text }]}>{courseName}</Text>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{DateHelpers.formatDate(new Date())}</Text>
      </View>

      <StudentAttendanceList
        students={students}
        isLoading={isLoading}
        existingAttendance={existingAttendance}
        onSubmitAll={handleSubmitAttendance}
        isSubmitting={isSubmitting}
        onOpenReport={(student) =>
          router.push(
            `/(teacher)/courses/${id}/student/${student.id}` as Href
          )
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 14,
    paddingVertical: 1,
    borderBottomWidth: 0,
  },
  courseName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 1,
  },
  date: {
    fontSize: 15,
  },
});
