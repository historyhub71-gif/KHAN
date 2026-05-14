export type UserRole = 'admin' | 'teacher' | 'student';
export type AttendanceStatus = 'present' | 'absent';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  approved: boolean;
  created_at: string;
}

export interface AuthUser extends Profile {
  email_verified_at?: string | null;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  created_by: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  course_id: string;
  student_id: string;
  teacher_id: string;
  status: AttendanceStatus;
  date: string;
  created_at: string;
}

export interface CourseTeacher {
  id: string;
  course_id: string;
  teacher_id: string;
}

export interface CourseStudent {
  id: string;
  course_id: string;
  student_id: string;
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  percentage: number;
}

export interface StudentWithAttendance extends Profile {
  attendanceStatus?: AttendanceStatus;
  attendancePercentage?: number;
}
