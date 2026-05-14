export const LightColors = {
  primary: '#007AFF', // iOS Blue
  secondary: '#5856D6', // deep purple
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',
  background: '#FFFFFF',
  surface: '#F8F9FA', // Very light gray for cards/inputs
  text: '#1C1C1E', // Darker text for better contrast
  textSecondary: '#6C757D',
  border: '#E9ECEF',
  white: '#FFFFFF',
  dark: '#1C1C1E',
  gray: '#ADB5BD',
  lightGray: '#F1F3F5',
  
  attendance: {
    present: '#34C759',
    absent: '#FF3B30',
    neutral: '#ADB5BD',
  },
  
  role: {
    admin: '#FF3B30',
    teacher: '#007AFF',
    student: '#5856D6',
  },
};

export const DarkColors = {
  primary: '#0A84FF',
  secondary: '#64D2FF',
  success: '#30D158',
  danger: '#FF453A',
  warning: '#FF9F0A',
  background: '#000000',
  surface: '#1C1C1E',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  border: '#38383A',
  white: '#FFFFFF',
  dark: '#000000',
  gray: '#8E8E93',
  lightGray: '#3A3A3C',
  
  attendance: {
    present: '#30D158',
    absent: '#FF453A',
    neutral: '#8E8E93',
  },
  
  role: {
    admin: '#FF6B6B',
    teacher: '#4ECDC4',
    student: '#FFE66D',
  },
};

// Default export for backward compatibility
export const Colors = LightColors;
