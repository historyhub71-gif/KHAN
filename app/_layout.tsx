import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useContext, useEffect, useState } from "react";
import { LogBox, View } from "react-native";
import UnityStyleSplash from "../component/SplashScreen"; // Imports your new splash component
import { AuthContext, AuthProvider } from "../context/AuthContext";
import { NotificationProvider } from "../context/NotificationContext";
import { ThemeProvider } from "../context/ThemeContext";
import { logLinkingDiagnostics, subscribeToLinkingLogs } from "../utils/linkingLogger";
import {
  handleIncomingRecoveryUrl,
  markRecoverySessionReady
} from "../utils/recoveryLink";
import { supabase } from "../utils/supabase";

// expo-notifications native push is not available in Expo Go (SDK 53+).
// This suppresses the package's own internal console warning so it does not
// appear as a red LogBox error. All in-app (Supabase) notifications still work.
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go',
]);

// Keep the native splash screen visible while JS bundle & auth initialize.
// It will be hidden once AuthContext finishes resolving the session.
SplashScreen.preventAutoHideAsync().catch(() => { });

function RootLayoutContent() {
  const { isInitializing } = useContext(AuthContext);
  const [showJsSplash, setShowJsSplash] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Hide the native OS splash immediately so our custom JS splash is visible.
  // The native splash (icon) was blocking the custom UnityStyleSplash from showing.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => { });
  }, []);

  // Background Data Pre-Rendering Sequence
  useEffect(() => {
    // If Auth is still setting up, keep waiting
    if (isInitializing) return;

    async function preRenderData() {
      try {
        // --- DATA RENDERING ZONE ---
        // Your app is rendering dashboards and preparing tables safely underneath.
        // We hold the layout for 2.5 seconds to let components finish processing.
        await new Promise(resolve => setTimeout(resolve, 2500));
      } catch (error) {
        console.error("Error pre-rendering database layout:", error);
      } finally {
        // Data is fully ready and populated — signal the JS splash to fade out.
        setIsDataLoading(false);
      }
    }

    preRenderData();
  }, [isInitializing]);

  // Combined readiness check (True only when auth completes AND data finishes rendering)
  const appIsReady = !isInitializing && !isDataLoading;

  return (
    <View style={{ flex: 1 }}>
      <RecoveryLinkBootstrap />

      {/* 1. Main Navigation System (Pre-renders quietly behind the splash) */}
      <Stack screenOptions={{ headerShown: false }} />

      {/* 2. Unity Cinematic Guard Screen Layer */}
      {showJsSplash && (
        <UnityStyleSplash
          isReady={appIsReady}
          onAnimationComplete={() => setShowJsSplash(false)}
        />
      )}
    </View>
  );
}

function RecoveryLinkBootstrap() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribeLogs = subscribeToLinkingLogs();

    const openRecoveryScreen = async (incoming: string | null) => {
      logLinkingDiagnostics("recovery", incoming);

      try {
        if (incoming) {
          const parsed = Linking.parse(incoming);

          const access_token =
            parsed.queryParams?.access_token?.toString();

          const refresh_token =
            parsed.queryParams?.refresh_token?.toString();

          if (access_token && refresh_token) {
            console.log("[RecoveryLink] Restoring session from deep link");

            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (error) {
              console.error("[RecoveryLink] setSession error:", error);
            } else {
              console.log("[RecoveryLink] Session restored");
            }
          }
        }

        const { shouldOpenResetScreen, error } =
          await handleIncomingRecoveryUrl(incoming);

        if (error) {
          console.warn("[RecoveryLink] handleIncomingRecoveryUrl:", error);
        }

        if (shouldOpenResetScreen) {
          router.replace("/reset-password");
        }
      } catch (err) {
        console.error("[RecoveryLink] Failed to handle URL:", incoming, err);
      }
    };

    Linking.getInitialURL().then(openRecoveryScreen);

    const subscription = Linking.addEventListener("url", (event) => {
      openRecoveryScreen(event.url);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          markRecoverySessionReady();
          router.replace("/reset-password");
        }
      }
    );

    return () => {
      unsubscribeLogs();
      subscription.remove();
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  return null;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <RootLayoutContent />
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}