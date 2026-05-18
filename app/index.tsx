import { useRouter } from "expo-router";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { MaterialIcons } from "@expo/vector-icons";

export default function Index() {
  const { user, authStatus, isLoading, error, refreshAuth } = useContext(AuthContext);
  const { colors } = useTheme();
  const router = useRouter();
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    let timer: any;
    if (isLoading) {
      timer = setTimeout(() => {
        setShowRetry(true);
      }, 10000); // Show retry after 10 seconds
    } else {
      setShowRetry(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) {
      if (authStatus === 'pending') {
        router.replace("/(auth)/pending-approval");
      } else if (authStatus === 'rejected') {
        router.replace("/(auth)/rejected");
      } else if (!user) {
        router.replace("/(auth)/login");
      } else {
        if (user.role === "admin") {
          router.replace("/(admin)/dashboard");
        } else if (user.role === "teacher") {
          router.replace("/(teacher)/dashboard");
        } else {
          router.replace("/(student)/dashboard");
        }
      }
    }
  }, [user, authStatus, isLoading]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* App Logo or Icon */}
        <View style={[styles.logoContainer, { backgroundColor: colors.surface }]}>
          <Image 
            source={require('../assets/images/icon.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        <Text style={[styles.appName, { color: colors.text }]}>Attendance System</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>Secure & Easy Tracking</Text>

        <View style={styles.loaderContainer}>
          {isLoading ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              {showRetry && (
                <View style={styles.slowConnectionContainer}>
                  <Text style={[styles.slowText, { color: colors.textSecondary }]}>
                    Connection is taking longer than usual...
                  </Text>
                  <TouchableOpacity 
                    style={[styles.retryButton, { backgroundColor: colors.primary }]}
                    onPress={() => refreshAuth()}
                  >
                    <MaterialIcons name="refresh" size={20} color={colors.white} />
                    <Text style={[styles.retryText, { color: colors.white }]}>Retry Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : error ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={48} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                onPress={() => refreshAuth()}
              >
                <Text style={[styles.retryText, { color: colors.white }]}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
      
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Powered by Hashir Khan</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    width: '80%',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    // Shadow for premium feel
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  logo: {
    width: 80,
    height: 80,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 48,
  },
  loaderContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slowConnectionContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  slowText: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    gap: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});