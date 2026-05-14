import { useCallback, useState } from 'react';
import { studentService } from '../services/studentService';
import { Attendance, AttendanceStats } from '../types';

export const useAttendance = () => {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async (studentId: string, courseId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await studentService.getAttendance(studentId, courseId);
      setAttendance(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (studentId: string, courseId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await studentService.getAttendanceStats(studentId, courseId);
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMonthlyAttendance = useCallback(
    async (studentId: string, courseId: string, year: number, month: number) => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await studentService.getMonthlyAttendance(
          studentId,
          courseId,
          year,
          month
        );
        setAttendance(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    attendance,
    stats,
    isLoading,
    error,
    fetchAttendance,
    fetchStats,
    fetchMonthlyAttendance,
  };
};
