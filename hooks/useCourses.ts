import { useCallback, useState } from 'react';
import { studentService } from '../services/studentService';
import { teacherService } from '../services/teacherService';
import { Course } from '../types';

export const useCourses = (userRole: 'student' | 'teacher') => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      let data;
      if (userRole === 'student') {
        data = await studentService.getCourses(userId);
      } else {
        data = await teacherService.getCourses(userId);
      }
      
      setCourses(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userRole]);

  return {
    courses,
    isLoading,
    error,
    fetchCourses,
  };
};
