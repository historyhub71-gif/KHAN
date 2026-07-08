export type UserRole = 'admin' | 'teacher' | 'student' | 'interviewer' | 'director';
export type AttendanceStatus = 'present' | 'absent' | null;

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  approved: boolean;
  status?: 'pending' | 'waiting_approval' | 'approved' | 'rejected';
  student_id?: string;
  official_check_in_time?: string;
  created_at: string;
  updated_at?: string;
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
  student?: Profile;
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
  student_id: string | null;
  teacher_id: string | null;
  course_id: string | null;
  attendance_id: string | null;
  user_id?: string | null;
  role?: string | null;
  notification_type?: string | null;
  status?: 'read' | 'unread';
  sent_at?: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  courses?: Pick<Course, 'id' | 'name' | 'code'>;
  profiles?: {
    id: string;
    name: string;
  };
  attendance?: {
    id: string;
    status: string;
    date: string;
  };
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
  studentProfile?: any;
  initialInterview?: any;
  progressReports?: any[];
  fortnightReviews?: any[];
  latestStatus?: string;
}

export interface CourseAttendanceSummary {
  totalStudents: number;
  totalPresent: number;
  totalAbsent: number;
  overallPercentage: number;
}

// =============================================================================
// NEW MODEL INTERFACES
// =============================================================================

export interface StudentProfile {
  id: string;
  email?: string;
  assigned_teacher_id: string | null;
  level: 'Beginner' | 'Elementary' | 'Intermediate' | 'Advanced' | null;
  class: string | null;
  section: string | null;
  created_at: string;
  updated_at: string;
  teacher_name?: string;
}

export interface AdmissionDeal {
  id: string;
  student_name: string;
  student_email: string;
  student_account_status: 'pending' | 'waiting_approval' | 'approved_for_signup' | 'account_created' | 'approved' | 'rejected';
  admission_status?: 'pending' | 'pending_admin_review' | 'approved' | 'rejected';
  father_name?: string;
  phone_number?: string;
  whatsapp_number?: string;
  course_id: string;
  course_name?: string;
  class?: string;
  teacher_id?: string;
  student_id?: string;
  original_fee: number;
  discount_amount: number;
  discount_percentage: number;
  final_fee: number;
  payment_status: 'pending' | 'paid';
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface TeacherProfile {
  id: string;
  created_at: string;
}

export interface InterviewerProfile {
  id: string;
  created_at: string;
}

export interface Interview {
  id: string;
  student_id: string;
  interviewer_id: string | null;
  interview_type: 'admission' | 'progress_review';
  notes: string | null;
  english: number | null;
  communication: number | null;
  confidence: number | null;
  technical_skills: number | null;
  learning_ability: number | null;
  total_score: number;
  assigned_level: 'Beginner' | 'Elementary' | 'Intermediate' | 'Advanced' | null;
  strengths: string | null;
  weaknesses: string | null;
  recommendations: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
  updated_at: string;
  student_name?: string;
  interviewer_name?: string;
}

export interface StudentProgressReview {
  id: string;
  student_id: string;
  admission_interview_id: string | null;
  review_interview_id: string | null;
  review_number: number;
  scheduled_date: string;
  completed_at: string | null;
  growth_report: string | null;
  improvement_percentage: number | null;
  created_at: string;
  student_name?: string;
}

export interface FeePayment {
  id: string;
  student_id: string;
  amount: number;
  due_date: string;
  status: 'unpaid' | 'pending' | 'approved' | 'rejected';
  payment_method: 'Cash' | 'Card' | 'Bank Transfer' | 'Mobile Wallet' | 'None';
  payment_date: string | null;
  notes: string | null;
  submitted_by: string | null;
  rejection_reason: string | null;
  balance_before?: number;
  balance_after?: number;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
  updated_at: string;
  student_name?: string;
  receipt_number?: string;
}

export interface FeeReceipt {
  id: string;
  payment_id: string;
  receipt_number: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
}

export interface TeacherAttendance {
  id: string;
  teacher_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'present' | 'absent' | 'late';
  created_at: string;
  teacher_name?: string;
}

export interface TeacherSalarySetting {
  id: string;
  teacher_id: string;
  monthly_salary: number;
  working_days: number;
  effective_from: string;
  created_at: string;
  teacher_name?: string;
}

export interface SalaryDeduction {
  id: string;
  teacher_id: string;
  month: number;
  year: number;
  base_salary: number;
  working_days: number;
  actual_absences: number;
  total_lates: number;
  effective_absences: number;
  deduction_amount: number;
  final_salary: number;
  created_at: string;
  teacher_name?: string;
}

export interface NotificationHistory {
  id: string;
  notification_id: string | null;
  user_id: string;
  role: string | null;
  notification_type: string | null;
  title: string | null;
  message: string | null;
  status: 'read' | 'unread';
  created_at: string;
  sent_at: string;
}

export interface StudentInterview {
  id: string;
  student_id: string;
  interview_type: 'admission' | 'fortnight_1' | 'fortnight_2' | 'fortnight_3' | 'fortnight_ongoing';
  interviewer_id: string | null;
  level: 'Beginner' | 'Elementary' | 'Intermediate' | 'Advanced' | null;
  english_level: string | null;
  subject_knowledge: string | null;
  learning_ability: string | null;
  notes: string | null;
  recommendations: string | null;
  recommended_course_id: string | null;
  recommended_teacher_id: string | null;
  recommended_class: string | null;
  created_at: string;
  student_name?: string;
  interviewer_name?: string;
  recommended_course_name?: string;
  recommended_teacher_name?: string;
  interview_assessments?: InterviewAssessment[];
}

export interface InterviewAssessment {
  id: string;
  interview_id: string;
  speaking_score: number;
  reading_score: number;
  writing_score: number;
  listening_score: number;
  attendance_score: number;
  remarks: string | null;
}

export interface StudentProgressReport {
  id: string;
  student_id: string;
  teacher_id: string | null;
  progress_notes: string | null;
  improvement_percentage: number;
  created_at: string;
  student_name?: string;
  teacher_name?: string;
}

export interface TeacherStudentNotification {
  id: string;
  teacher_id: string;
  student_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  student_name?: string;
}

export interface FeeLedger {
  id: string;
  student_id: string;
  total_fee: number;
  paid_amount: number;
  remaining_balance: number;
  remarks: string | null;
  collected_by: string | null;
  payment_date: string;
  student_name?: string;
  collected_by_name?: string;
}
