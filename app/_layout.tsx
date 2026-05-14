import { Stack } from "expo-router";
import { AuthProvider, AuthContext } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import * as SplashScreen from 'expo-splash-screen';
import { useContext, useEffect } from "react";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { isLoading } = useContext(AuthContext);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutContent />
      </AuthProvider>
    </ThemeProvider>
  );
}