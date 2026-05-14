import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { ScreenContainer } from '../../../component/common/ScreenContainer';
import { StudentAttendanceList } from '../../../component/teacher/StudentAttendanceList';
import { useAuth } from '../../../hooks/useAuth';
import { teacherService } from '../../../services/teacherService';
import { Profile } from '../../../types';
import { Colors } from '../../../utils/colors';
import { DateHelpers } from '../../../utils/dateHelpers';

export default function CourseAttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [existingAttendance, setExistingAttendance] = useState<{ [studentId: string]: 'present' | 'absent' }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courseName, setCourseName] = useState('');

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
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
      const attendanceMap: { [studentId: string]: 'present' | 'absent' } = {};
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
  };

  const handleSubmitAttendance = async (attendanceMap: { [studentId: string]: 'present' | 'absent' }) => {
    if (!user?.id || !id) return;

    try {
      setIsSubmitting(true);
      const today = DateHelpers.formatISO(new Date());
      
      const promises = Object.entries(attendanceMap).map(([studentId, status]) =>
        teacherService.markAttendance(id, studentId, status, today, user.id)
      );
      
      await Promise.all(promises);
      
      Alert.alert('Success', 'Attendance submitted successfully');
      
      // Refresh data to show updated attendance
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', 'Failed to submit attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.courseName}>{courseName}</Text>
        <Text style={styles.date}>{DateHelpers.formatDate(new Date())}</Text>
      </View>

      <StudentAttendanceList
        students={students}
        isLoading={isLoading}
        existingAttendance={existingAttendance}
        onSubmitAll={handleSubmitAttendance}
        isSubmitting={isSubmitting}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  courseName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark,
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: Colors.gray,
  },
});
