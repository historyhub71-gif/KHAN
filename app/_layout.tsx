import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useContext, useEffect } from "react";
import { LogBox } from "react-native";
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

// Hiding splash screen immediately to prevent native white splash screen on app entrance
SplashScreen.hideAsync().catch(() => {});

function RootLayoutContent() {
  const { isInitializing } = useContext(AuthContext);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      <RecoveryLinkBootstrap />
      <Stack screenOptions={{ headerShown: false }} />
    </>
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