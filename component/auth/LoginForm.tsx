import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Validation, ValidationMessages } from '../../utils/validation';
import { Button } from '../common/Button';
import { TextInput } from '../common/TextInput';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  onSignUpPress?: () => void;
  onForgotPasswordPress?: () => void;
  isLoading?: boolean;
  error?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  onSignUpPress,
  onForgotPasswordPress,
  isLoading = false,
  error,
}) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

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

    if (!password.trim()) {
      setPasswordError(ValidationMessages.required);
      isValid = false;
    } else {
      setPasswordError('');
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (validateForm()) {
      try {
        await onSubmit(email, password);
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
          <Ionicons name="lock-open" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sign in to access your dashboard</Text>
      </Animated.View>

      {error && (
        <Animated.View style={[
          styles.errorAlert,
          { backgroundColor: colors.danger + '10', borderColor: colors.danger, opacity: fadeAnim }
        ]}>
          <Ionicons name="alert-circle" size={20} color={colors.danger} />
          <Text style={[styles.errorAlertText, { color: colors.danger }]}>{error}</Text>
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

        <TextInput
          label="Password"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          error={passwordError}
          editable={!isLoading}
          containerStyle={styles.field}
          leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />}
        />

        <TouchableOpacity
          style={styles.forgotPassword}
          onPress={onForgotPasswordPress}
          disabled={isLoading}
        >
          <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Forgot Password?</Text>
        </TouchableOpacity>

        <Button
          title="Sign In"
          onPress={handleSubmit}
          loading={isLoading}
          fullWidth
          size="large"
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
        />

        {__DEV__ && (
          <View style={styles.devSection}>
            <View style={styles.devDivider}>
              <View style={[styles.devDividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.devLabel, { color: colors.textSecondary, backgroundColor: colors.background }]}>
                DEV QUICK LOGIN
              </Text>
              <View style={[styles.devDividerLine, { backgroundColor: colors.border }]} />
            </View>
            <View style={styles.devButtons}>
              {[
                { label: '👨‍💼 Admin', email: 'hasherkhano097@gmail.com', password: '369258' },
                { label: '🎓 Student', email: 'ansar@gmail.com', password: '123456' },
                { label: '👨‍🏫 Teacher', email: 'khan@gmail.com', password: '123456' },
                { label: '💰 Director', email: 'hafiz@gmail.com', password: '123456' },
                { label: '📝 ASR', email: 'iqrar@gmail.com', password: '123456' },
              ].map((acc) => (
                <TouchableOpacity
                  key={acc.email}
                  style={[styles.devButton, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}
                  onPress={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                    onSubmit(acc.email, acc.password).catch(console.error);
                  }}
                  disabled={isLoading}
                >
                  <Text style={[styles.devButtonText, { color: colors.primary }]}>{acc.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Don't have an account? </Text>
        <TouchableOpacity onPress={onSignUpPress} disabled={isLoading}>
          <Text style={[styles.footerLink, { color: colors.primary }]}>Create one now</Text>
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
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    gap: 12,
  },
  errorAlertText: {
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '700',
  },
  submitButton: {
    borderRadius: 20,
    height: 60,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 10,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '800',
  },
  devSection: {
    marginTop: 24,
  },
  devDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  devDividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.4,
  },
  devLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: 4,
  },
  devButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  devButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  devButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
