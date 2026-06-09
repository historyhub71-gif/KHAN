import * as Linking from "expo-linking";
import { useRouter, useSegments } from "expo-router";
import { useContext, useEffect } from "react";
import { View } from "react-native";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { isPasswordRecoveryActive, isRecoveryUrl } from "../utils/recoveryLink";

export default function Index() {
  const { user, authStatus, isInitializing } = useContext(AuthContext);
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isInitializing) return;

    const redirect = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();

        if (
          (segments as string[])?.includes("reset-password") ||
          isRecoveryUrl(initialUrl) ||
          isPasswordRecoveryActive()
        ) {
          return;
        }

        if (authStatus === "pending") {
          router.replace("/(auth)/pending-approval");
          return;
        }

        if (authStatus === "rejected") {
          router.replace("/(auth)/rejected");
          return;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        const role = user.role;

        if (role === "admin") {
          router.replace("/(admin)/dashboard");
        } else if (role === "teacher") {
          router.replace("/(teacher)/dashboard");
        } else {
          router.replace("/(student)/dashboard");
        }
      } catch (error) {
        router.replace("/login");
      }
    };

    redirect();
  }, [user, authStatus, isInitializing, segments]);

  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}