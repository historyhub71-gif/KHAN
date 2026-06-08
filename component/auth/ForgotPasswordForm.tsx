import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Validation, ValidationMessages } from '../../utils/validation';
import { Button } from '../common/Button';
import { TextInput } from '../common/TextInput';

interface ForgotPasswordFormProps {
  onSubmit: (email: string) => Promise<void>;
  onBackToLoginPress: () => void;
  isLoading?: boolean;
  error?: string;
  successMessage?: string;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onSubmit,
  onBackToLoginPress,
  isLoading = false,
  error,
  successMessage,
}) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // Animation state
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const validateForm = () => {
    let isValid = true;

    if (!email.trim()) {
      setEmailError(ValidationMessages.required);
      isValid = false;
    } else if (!Validation.isEmail(email)) {
      setEmailError(ValidationMessages.invalidEmail);
      isValid = false;
    } else {
      setEmailError('');
    }

    return isValid;
  };

  const handleSubmit = async () => {
    // Trim email before validation to avoid whitespace issues
    const trimmedEmail = email.trim();
    setEmail(trimmedEmail);

    if (validateForm()) {
      try {
        await onSubmit(trimmedEmail);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
    >
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="key-outline" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter your email to receive a password reset link
        </Text>
      </Animated.View>

      {error && (
        <Animated.View style={[
          styles.alert,
          { backgroundColor: colors.danger + '10', borderColor: colors.danger, opacity: fadeAnim }
        ]}>
          <Ionicons name="alert-circle" size={20} color={colors.danger} />
          <Text style={[styles.alertText, { color: colors.danger }]}>{error}</Text>
        </Animated.View>
      )}

      {successMessage && (
        <Animated.View style={[
          styles.alert,
          { backgroundColor: colors.success + '10', borderColor: colors.success, opacity: fadeAnim }
        ]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={[styles.alertText, { color: colors.success }]}>{successMessage}</Text>
        </Animated.View>
      )}

      <Animated.View style={[styles.form, { opacity: fadeAnim }]}>
        <TextInput
          label="Email Address"
          placeholder="your@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          error={emailError}
          editable={!isLoading}
          containerStyle={styles.field}
          leftIcon={<Ionicons name="mail-outline" size={20} color={colors.textSecondary} />}
        />

        <Button
          title="Send Reset Link"
          onPress={handleSubmit}
          loading={isLoading}
          fullWidth
          size="large"
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
        />
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={onBackToLoginPress} disabled={isLoading}>
          <Text style={[styles.footerLink, { color: colors.primary }]}>Back to Sign In</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    gap: 12,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  form: {
    marginBottom: 32,
    gap: 8,
  },
  field: {
    marginBottom: 16,
  },
  submitButton: {
    borderRadius: 20,
    height: 60,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 10,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '800',
  },
});
