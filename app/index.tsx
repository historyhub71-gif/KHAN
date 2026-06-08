import { useRouter, useSegments } from "expo-router";
import * as Linking from "expo-linking";
import { useContext, useEffect } from "react";
import { isPasswordRecoveryActive, isRecoveryUrl } from "../utils/recoveryLink";
import { View } from "react-native";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Index() {
  const { user, authStatus, isInitializing } = useContext(AuthContext);
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isInitializing) return;

    if ((segments as string[]).includes("reset-password") || isPasswordRecoveryActive()) {
      return;
    }

    const redirect = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (isRecoveryUrl(initialUrl) || isPasswordRecoveryActive()) {
        return;
      }

      if (authStatus === "pending") {
        router.replace("/(auth)/pending-approval");
      } else if (authStatus === "rejected") {
        router.replace("/(auth)/rejected");
      } else if (!user) {
        router.replace("/(auth)/login");
      } else if (user.role === "admin") {
        router.replace("/(admin)/dashboard");
      } else if (user.role === "teacher") {
        router.replace("/(teacher)/dashboard");
      } else {
        router.replace("/(student)/dashboard");
      }
    };

    redirect();
  }, [user, authStatus, isInitializing, segments, router]);

  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
