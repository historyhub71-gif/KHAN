import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Animated,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';

export default function RejectedScreen() {
  const { signOut, authStatus, isLoading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  
  // Animation state
  const [fadeAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('[RejectedScreen] Sign-out error:', err);
    }
  };

  // Navigate to login when user is cleared (signOut successful)
  React.useEffect(() => {
    if (authStatus !== 'rejected' && !isLoading) {
      router.replace('/(auth)/login');
    }
  }, [authStatus, isLoading]);

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: colors.danger + '15' }]}>
            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            <Text style={[styles.statusText, { color: colors.danger }]}>Access Denied</Text>
          </View>

          {/* Icon Section */}
          <View style={styles.iconWrapper}>
            <View style={[styles.iconBg, { backgroundColor: colors.surface }]}>
              <MaterialIcons
                name="block"
                size={80}
                color={colors.danger}
              />
            </View>
            <View style={[styles.pulseCircle, { borderColor: colors.danger + '30' }]} />
          </View>

          {/* Main Message */}
          <Text style={[styles.title, { color: colors.text }]}>Account Rejected</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Your account request was rejected. Please contact admin or try again later.
          </Text>

          {/* User Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.infoCardTitle, { color: colors.textSecondary }]}>WHAT&apos;s NEXT?</Text>
            
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: colors.background }]}>
                <Ionicons name="information-circle-outline" size={18} color={colors.danger} />
              </View>
              <View style={styles.infoText}>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  You can sign out and register again, or contact the school administration for details.
                </Text>
              </View>
            </View>
          </View>

        </Animated.View>

        {/* Footer Actions */}
        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={[
              styles.logoutButton, 
              { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}  
            onPress={handleLogout}
            disabled={isLoading}  
          >
            <MaterialIcons name="logout" size={20} color={colors.white} />
            <Text style={[styles.logoutButtonText, { color: colors.white }]}>
              {isLoading ? 'Processing...' : 'Sign Out & Return to Login'}
            </Text> 
          </TouchableOpacity>
          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            Need help? Contact support at support@example.com
          </Text>
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'space-between',
  },
  content: {
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  iconWrapper: {
    marginBottom: 32,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBg: {
    borderRadius: 60,
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  pulseCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    zIndex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  infoCard: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
  },
  infoCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    gap: 16,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoutButton: {
    flexDirection: 'row',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    borderWidth: 1,
    marginBottom: 20,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  helpText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});
