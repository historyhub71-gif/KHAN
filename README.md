# HASHIR KHAN's Attendance System - Mobile App

A comprehensive mobile application for managing student attendance built with **Expo** and **React Native**. This cross-platform app supports multiple user roles (Admin, Teachers, and Students) with role-based dashboards and features.

## 📋 Overview

The Attendance System is a mobile-first solution designed to streamline attendance management in educational institutions. It provides:

- **Role-based access** for Admins, Teachers, and Students
- **Real-time attendance tracking** with visual calendars
- **Course management** system
- **User authentication** with Supabase
- **Cross-platform support** (iOS, Android, Web)

## 🎯 Features

### Admin Features
- Manage teachers and students
- View course assignments
- Oversee attendance records
- Approve/manage user registrations

### Teacher Features
- Manage assigned courses
- Track student attendance
- View attendance statistics
- Access student lists per course

### Student Features
- View assigned courses
- Track personal attendance
- View attendance calendar
- Monitor attendance statistics

## 🛠️ Tech Stack

- **Framework**: [Expo](https://expo.dev) - Build universal React Native apps
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Backend**: [Supabase](https://supabase.com/) - PostgreSQL database with authentication
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) - File-based routing
- **State Management**: React Context API
- **HTTP Client**: Built-in services layer
- **Development**: ESLint for code quality

## 📁 Project Structure

```
attendance-system/
├── app/                              # Main app screens (Expo Router)
│   ├── _layout.tsx                  # Root layout
│   ├── index.tsx                    # Home/entry point
│   ├── (admin)/                     # Admin role screens
│   │   ├── dashboard.tsx
│   │   ├── courses.tsx
│   │   ├── students.tsx
│   │   ├── teachers.tsx
│   │   └── course-assignments.tsx
│   ├── (auth)/                      # Authentication screens
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── pending-approval.tsx
│   ├── (student)/                   # Student role screens
│   │   ├── dashboard.tsx
│   │   └── courses/
│   │       └── [id].tsx
│   └── (teacher)/                   # Teacher role screens
│       ├── dashboard.tsx
│       └── courses/
│           └── [id].tsx
│
├── component/                       # Reusable React components
│   ├── admin/                       # Admin-specific components
│   │   ├── CourseList.tsx
│   │   └── UserList.tsx
│   ├── auth/                        # Auth-specific components
│   │   ├── LoginForm.tsx
│   │   └── SignupForm.tsx
│   ├── common/                      # Shared components
│   │   ├── AlertModal.tsx
│   │   ├── Button.tsx
│   │   ├── EmptyState.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── ScreenContainer.tsx
│   │   └── TextInput.tsx
│   ├── student/                     # Student-specific components
│   │   ├── AttendanceCalendar.tsx
│   │   ├── AttendanceStats.tsx
│   │   └── CourseCard.tsx
│   └── teacher/                     # Teacher-specific components
│       ├── CourseCard.tsx
│       └── StudentAttendanceList.tsx
│
├── context/                         # React Context for state management
│   └── AuthContext.tsx              # Global auth state & user info
│
├── hooks/                           # Custom React hooks
│   ├── useAuth.ts                   # Authentication logic
│   ├── useAttendance.ts             # Attendance data management
│   └── useCourses.ts                # Course data management
│
├── services/                        # API service layers
│   ├── authService.ts               # Authentication API calls
│   ├── adminService.ts              # Admin-specific API calls
│   ├── teacherService.ts            # Teacher-specific API calls
│   └── studentService.ts            # Student-specific API calls
│
├── types/                           # TypeScript type definitions
│   └── index.ts                     # Global types & interfaces
│
├── utils/                           # Utility functions
│   ├── supabase.ts                  # Supabase client config
│   ├── colors.ts                    # Color constants
│   ├── constants.ts                 # App constants
│   ├── dateHelpers.ts               # Date utility functions
│   └── validation.ts                # Form validation functions
│
├── assets/                          # Static assets
│   └── images/                      # Image files
│
├── app.json                         # Expo app configuration
├── expo-env.d.ts                    # Expo environment types
├── tsconfig.json                    # TypeScript configuration
├── eslint.config.js                 # ESLint configuration
└── package.json                     # Project dependencies
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v14 or higher)
- **npm** or **yarn** package manager
- **Expo CLI** (optional but recommended)
  ```bash
  npm install -g expo-cli
  ```

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd attendance-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Create a `.env` file in the root directory
   - Add your Supabase configuration:
     ```
     EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
     EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
     ```

### Running the App

1. **Start the development server**
   ```bash
   npx expo start
   ```

2. **Open on your device**

   The command will display a QR code. You can:

   - **Press `i`** - Open in iOS simulator (macOS only)
   - **Press `a`** - Open in Android emulator
   - **Press `w`** - Open in web browser
   - **Scan QR code** - Use Expo Go app on your device

### Development

- Edit files in the **`app/`** directory to modify screens
- Edit files in the **`component/`** directory to modify components
- The app uses **file-based routing**, so create new files in `app/` to create new routes
- Changes are reflected instantly via hot reload

## 🔐 Authentication & Authorization

The app implements role-based authentication:

### User Roles

1. **Admin** - Full system access
   - Navigate to `/(admin)/*` routes
   - Can manage all users and courses

2. **Teacher** - Course and attendance management
   - Navigate to `/(teacher)/*` routes
   - Can manage assigned courses and track student attendance

3. **Student** - Attendance tracking
   - Navigate to `/(student)/*` routes
   - Can view assigned courses and attendance records

### Authentication Flow

1. Users sign up or log in via `/(auth)` routes
2. Auth state is managed globally via `AuthContext`
3. `useAuth()` hook provides user data and auth functions
4. Role-based routing is determined at app startup in `index.tsx`
5. Unapproved users are redirected to pending approval screen

## 📱 Key Components

### Custom Hooks

- **`useAuth()`** - Access current user, login, signup, logout functions
- **`useAttendance()`** - Manage attendance data and operations
- **`useCourses()`** - Fetch and manage course information

### Contexts

- **`AuthContext`** - Provides global authentication state and user information

### Common Utilities

- **`supabase.ts`** - Supabase client initialization
- **`validation.ts`** - Form validation functions
- **`dateHelpers.ts`** - Date manipulation utilities
- **`constants.ts`** - Application-wide constants

## 📚 Development Guide

### Adding a New Screen

1. Create a new file in the appropriate `app/` subdirectory
2. The file path automatically becomes the route
3. Use `useRouter()` from Expo Router for navigation

```tsx
// Example: app/(student)/new-screen.tsx
import { useRouter } from 'expo-router';

export default function NewScreen() {
  const router = useRouter();
  
  return (
    // Your screen content
  );
}
```

### Adding a New Component

1. Create a new file in `component/` (organized by feature)
2. Export the component
3. Import and use in screens

### Making API Calls

1. Add methods to the appropriate service file in `services/`
2. Use the custom hooks to access service functions
3. Services handle all Supabase communication

Example:
```tsx
// In services/studentService.ts
export const getStudentCourses = async (studentId: string) => {
  // API call logic
};

// In hooks/useCourses.ts
export const useCourses = () => {
  const { data } = useQuery(() => getStudentCourses(userId));
  return { data };
};
```

## 🧪 Testing

Run ESLint to check code quality:
```bash
npm run lint
```

## 🔗 Useful Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Supabase Documentation](https://supabase.com/docs)
- [Expo Router Guide](https://docs.expo.dev/router/introduction/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 📝 Environment Setup

### Available Scripts

```bash
# Start development server
npm start

# Run ESLint
npm run lint

# Reset project to blank state
npm run reset-project
```

## 🤝 Contributing

1. Create a new branch for your feature
2. Make your changes
3. Test thoroughly
4. Submit a pull request with a clear description

## 📄 License

This project is part of an educational institution's attendance management system.

## 📞 Support

For issues or questions, please contact the development team or open an issue in the repository.

---

**Happy coding! 🎉**
