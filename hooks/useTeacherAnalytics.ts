import { useCallback, useRef, useState } from 'react';
import { analyticsService } from '../services/analyticsService';
import { teacherService } from '../services/teacherService';
import {
  AttendanceHistoryByDate,
  Course,
  CourseAttendanceSummary,
  StudentCourseAnalytics,
  TeacherDailyAnalytics,
} from '../types';
import { DateHelpers } from '../utils/dateHelpers';

export const useTeacherAnalytics = (teacherId: string | undefined) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [dailyStats, setDailyStats] = useState<TeacherDailyAnalytics | null>(null);
  const [courseSummary, setCourseSummary] = useState<CourseAttendanceSummary | null>(null);
  const [studentAnalytics, setStudentAnalytics] = useState<StudentCourseAnalytics[]>([]);
  const [frequentAbsentees, setFrequentAbsentees] = useState<StudentCourseAnalytics[]>([]);
  const [historyByDate, setHistoryByDate] = useState<AttendanceHistoryByDate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const lastRequestId = useRef(0);

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
    async (courseId: string, showLoading = true) => {
      if (!teacherId) return;
      const requestId = ++lastRequestId.current;
      
      try {
        if (showLoading) {
          setIsLoading(true);
          // Immediately reset state to avoid showing stale data from previous courses
          setDailyStats(null);
          setCourseSummary(null);
          setStudentAnalytics([]);
          setFrequentAbsentees([]);
          setHistoryByDate([]);
        }
        setError(null);

        const owns = await analyticsService.verifyTeacherOwnsCourse(teacherId, courseId);
        if (requestId !== lastRequestId.current) return;

        if (!owns) {
          setError('You are not assigned to this course');
          return;
        }

        const today = DateHelpers.formatISO(new Date());
        const data = await analyticsService.getCourseAnalytics(courseId, today);

        if (requestId !== lastRequestId.current) return;

        setDailyStats(data.dailyStats);
        setCourseSummary(data.courseSummary);
        setStudentAnalytics(data.studentAnalytics);
        setFrequentAbsentees(data.frequentAbsentees);
        setHistoryByDate(data.historyByDate);
      } catch (err: unknown) {
        if (requestId === lastRequestId.current) {
          setError(err instanceof Error ? err.message : 'Failed to load analytics');
        }
      } finally {
        if (showLoading && requestId === lastRequestId.current) {
          setIsLoading(false);
        }
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
    courseSummary,
    studentAnalytics,
    frequentAbsentees,
    historyByDate,
    setHistoryByDate,
    isLoading,
    error,
    fetchCourses,
    fetchAnalytics,
    selectCourse,
  };
};
