export type UserRole = 'admin' | 'teacher' | 'student';
export type AttendanceStatus = 'present' | 'absent';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  approved: boolean;
  status?: 'pending' | 'approved' | 'rejected';
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
  teacher_name?: string;
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

export interface Notification {
  id: string;
  student_id: string;
  teacher_id: string | null;
  course_id: string;
  attendance_id: string | null;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  courses?: Pick<Course, 'id' | 'name' | 'code'>;
}

export interface TeacherDailyAnalytics {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  attendanceRateToday: number;
}

export interface StudentCourseAnalytics {
  student: Profile;
  present: number;
  absent: number;
  percentage: number;
}

export interface StudentGlobalAttendance {
  totalPresent: number;
  totalAbsent: number;
  percentage: number;
}

export interface AttendanceHistoryByDate {
  date: string;
  present: number;
  absent: number;
  total: number;
}

export interface MonthlyAttendanceSummary {
  month: string;
  year: number;
  monthIndex: number;
  present: number;
  absent: number;
  percentage: number;
}

export interface StudentAttendanceReport {
  appName: string;
  student: Profile;
  course: Course;
  teacher: Profile;
  stats: AttendanceStats;
  history: Attendance[];
  monthlySummaries: MonthlyAttendanceSummary[];
  frequentAbsentWarning: boolean;
  generatedAt: string;
}
