export const Validation = {
  isEmail: (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isStrongPassword: (password: string) => {
    return password.length >= 6;
  },

  isValidName: (name: string) => {
    return name.trim().length >= 2;
  },

  isValidCourseCode: (code: string) => {
    return code.trim().length >= 2 && code.trim().length <= 10;
  },

  isValidCourseName: (name: string) => {
    return name.trim().length >= 3;
  },
};

export const ValidationMessages = {
  invalidEmail: 'Please enter a valid email address',
  weakPassword: 'Password must be at least 6 characters',
  invalidName: 'Name must be at least 2 characters',
  invalidCourseCode: 'Course code must be 2-10 characters',
  invalidCourseName: 'Course name must be at least 3 characters',
  required: 'This field is required',
  passwordMismatch: 'Passwords do not match',
};
