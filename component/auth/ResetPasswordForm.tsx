import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Validation, ValidationMessages } from '../../utils/validation';
import { Button } from '../common/Button';
import { TextInput } from '../common/TextInput';

interface ResetPasswordFormProps {
  onSubmit: (password: string) => Promise<void>;
  onCancelPress: () => void;
  isLoading?: boolean;
  error?: string;
  successMessage?: string;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  onSubmit,
  onCancelPress,
  isLoading = false,
  error,
  successMessage,
}) => {
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  
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

    if (!password.trim()) {
      setPasswordError(ValidationMessages.required);
      isValid = false;
    } else if (!Validation.isStrongPassword(password)) {
      setPasswordError(ValidationMessages.weakPassword);
      isValid = false;
    } else {
      setPasswordError('');
    }

    if (!confirmPassword.trim()) {
      setConfirmError(ValidationMessages.required);
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmError(ValidationMessages.passwordMismatch);
      isValid = false;
    } else {
      setConfirmError('');
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (validateForm()) {
      try {
        await onSubmit(password);
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
          <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>New Password</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Please enter and confirm your new account password
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
          label="New Password"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          error={passwordError}
          editable={!isLoading}
          containerStyle={styles.field}
          leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />}
        />

        <TextInput
          label="Confirm New Password"
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          error={confirmError}
          editable={!isLoading}
          containerStyle={styles.field}
          leftIcon={<Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />}
        />

        <Button
          title="Update Password"
          onPress={handleSubmit}
          loading={isLoading}
          fullWidth
          size="large"
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
        />
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={onCancelPress} disabled={isLoading}>
          <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Cancel & Go Back</Text>
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
    fontWeight: '600',
  },
});
