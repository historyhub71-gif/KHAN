import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { DarkColors, LightColors } from '../utils/colors';

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  colors: typeof LightColors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Force theme to light as requested
  const [theme, setThemeState] = useState<ThemeType>('light');

  const toggleTheme = () => {
    // Disabled toggle - always stay in light mode
    setThemeState('light');
  };

  const setTheme = (newTheme: ThemeType) => {
    // Force to light regardless of input
    setThemeState('light');
  };

  const value = {
    theme: 'light' as ThemeType,
    colors: LightColors,
    isDark: false,
    toggleTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
