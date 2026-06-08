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

export default function PendingApprovalScreen() {
  const { user, signOut, isUnapproved, isLoading } = useAuth();
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
  }, [fadeAnim]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('[PendingApproval] Sign-out error:', err);
    }
  };

  // Navigate to login when user is cleared (signOut successful)
  React.useEffect(() => {
    if (!isUnapproved && !isLoading) {
      router.replace('/(auth)/login');
    }
  }, [isUnapproved, isLoading, router]);

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: colors.warning + '15' }]}>
            <View style={[styles.dot, { backgroundColor: colors.warning }]} />
            <Text style={[styles.statusText, { color: colors.warning }]}>Verification Required</Text>
          </View>

          {/* Icon Section */}
          <View style={styles.iconWrapper}>
            <View style={[styles.iconBg, { backgroundColor: colors.surface }]}>
              <MaterialIcons
                name="verified-user"
                size={80}
                color={colors.primary}
              />
            </View>
            <View style={[styles.pulseCircle, { borderColor: colors.primary + '30' }]} />
          </View>

          {/* Main Message */}
          <Text style={[styles.title, { color: colors.text }]}>Account Pending Approval</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Hello <Text style={{ color: colors.text, fontWeight: '700' }}>{user?.name}</Text>, your registration is successful. An administrator is currently reviewing your profile to ensure security.
          </Text>

          {/* User Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.infoCardTitle, { color: colors.textSecondary }]}>REGISTRATION DETAILS</Text>
            
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: colors.background }]}>
                <Ionicons name="mail-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Email Address</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{user?.email}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: colors.background }]}>
                <Ionicons name="people-outline" size={18} color={colors.secondary} />
              </View>
              <View style={styles.infoText}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Account Role</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {user && user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          {/* Steps Section */}
          <View style={styles.stepsSection}>
            <Text style={[styles.stepsTitle, { color: colors.text }]}>Next Steps</Text>
            
            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>Admin reviews your credentials</Text>
            </View>

            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary + '40' }]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>You receive confirmation access</Text>
            </View>
          </View>
        </Animated.View>

        {/* Footer Actions */}
        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={[
              styles.logoutButton, 
              { backgroundColor: colors.surface, borderColor: colors.danger }
            ]}  
            onPress={handleLogout}
            disabled={isLoading}  
          >
            <MaterialIcons name="logout" size={20} color={colors.danger} />
            <Text style={[styles.logoutButtonText, { color: colors.danger }]}>
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
    marginBottom: 20,
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
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  stepsSection: {
    width: '100%',
    paddingHorizontal: 4,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepText: {
    fontSize: 14,
    fontWeight: '500',
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
