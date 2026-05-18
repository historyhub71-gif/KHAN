import { useCallback, useState } from 'react';
import { analyticsService } from '../services/analyticsService';
import { teacherService } from '../services/teacherService';
import {
  AttendanceHistoryByDate,
  Course,
  StudentCourseAnalytics,
  TeacherDailyAnalytics,
} from '../types';
import { DateHelpers } from '../utils/dateHelpers';

export const useTeacherAnalytics = (teacherId: string | undefined) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [dailyStats, setDailyStats] = useState<TeacherDailyAnalytics | null>(null);
  const [studentAnalytics, setStudentAnalytics] = useState<StudentCourseAnalytics[]>([]);
  const [frequentAbsentees, setFrequentAbsentees] = useState<StudentCourseAnalytics[]>([]);
  const [historyByDate, setHistoryByDate] = useState<AttendanceHistoryByDate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    if (!teacherId) return;
    try {
      setError(null);
      const data = await teacherService.getCourses(teacherId);
      setCourses(data);
      if (data.length > 0) {
        setSelectedCourseId((prev) => prev ?? data[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load courses');
    }
  }, [teacherId]);

  const fetchAnalytics = useCallback(
    async (courseId: string) => {
      if (!teacherId) return;
      try {
        setIsLoading(true);
        setError(null);

        const owns = await analyticsService.verifyTeacherOwnsCourse(teacherId, courseId);
        if (!owns) {
          setError('You are not assigned to this course');
          return;
        }

        const today = DateHelpers.formatISO(new Date());
        const [daily, students, frequent, history] = await Promise.all([
          analyticsService.getTeacherDailyAnalytics(courseId, today),
          analyticsService.getStudentAnalyticsForCourse(courseId),
          analyticsService.getFrequentAbsentees(courseId),
          analyticsService.getAttendanceHistoryByDate(courseId),
        ]);

        setDailyStats(daily);
        setStudentAnalytics(students);
        setFrequentAbsentees(frequent);
        setHistoryByDate(history);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    },
    [teacherId]
  );

  const selectCourse = useCallback((courseId: string) => {
    setSelectedCourseId(courseId);
  }, []);

  return {
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
  };
};
