import { useCallback, useState } from 'react';
import { studentService } from '../services/studentService';
import { StudentGlobalAttendance } from '../types';

export const useStudentOverview = (studentId: string | undefined) => {
  const [overview, setOverview] = useState<StudentGlobalAttendance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    if (!studentId) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await studentService.getGlobalAttendance(studentId);
      setOverview(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance overview');
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  return { overview, isLoading, error, fetchOverview };
};
