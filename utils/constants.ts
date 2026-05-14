export const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
} as const;

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
} as const;

export const API_ERRORS = {
  AUTH_FAILED: 'Authentication failed',
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_EXISTS: 'User already exists',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  NETWORK_ERROR: 'Network error. Please try again.',
  SIGNUP_FAILED: 'Sign up failed. Please try again.',
  SIGNIN_FAILED: 'Sign in failed. Please try again.',
};

export const ROLE_LABELS = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
} as const;

export const ATTENDANCE_LABELS = {
  present: 'Present',
  absent: 'Absent',
} as const;
