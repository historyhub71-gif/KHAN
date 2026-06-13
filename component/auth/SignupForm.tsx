import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Validation, ValidationMessages } from '../../utils/validation';
import { Button } from '../common/Button';
import { TextInput } from '../common/TextInput';

interface SignupFormProps {
  onSubmit: (email: string, password: string, name: string, role: 'teacher' | 'student' | 'interviewer') => Promise<void>;
  onSignInPress?: () => void;
  isLoading?: boolean;
  error?: string;
}

export const SignupForm: React.FC<SignupFormProps> = ({
  onSubmit,
  onSignInPress,
  isLoading = false,
  error,
}) => {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'teacher' | 'student' | 'interviewer' | null>(null);

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [roleError, setRoleError] = useState('');

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

    if (!name.trim()) {
      setNameError(ValidationMessages.required);
      isValid = false;
    } else if (!Validation.isValidName(name)) {
      setNameError(ValidationMessages.invalidName);
      isValid = false;
    } else {
      setNameError('');
    }

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

    if (!selectedRole) {
      setRoleError('Please select your role');
      isValid = false;
    } else {
      setRoleError('');
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (validateForm() && selectedRole) {
      try {
        await onSubmit(email, password, name, selectedRole);
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
        <View style={[styles.iconBox, { backgroundColor: colors.secondary + '15' }]}>
          <Ionicons name="person-add" size={32} color={colors.secondary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Join the Platform</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Create an account to start tracking</Text>
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
          label="Full Name"
          placeholder="John Doe"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          error={nameError}
          editable={!isLoading}
          leftIcon={<Ionicons name="person-outline" size={20} color={colors.textSecondary} />}
        />

        <TextInput
          label="Email Address"
          placeholder="your@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          error={emailError}
          editable={!isLoading}
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
          leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />}
        />

        <TextInput
          label="Confirm Password"
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          error={confirmError}
          editable={!isLoading}
          leftIcon={<Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />}
        />

        <View style={styles.roleSection}>
          <Text style={[styles.label, { color: colors.text }]}>
            Identify as a {roleError && <Text style={{ color: colors.danger }}>*</Text>}
          </Text>
          <View style={styles.roleContainer}>
            <TouchableOpacity
              onPress={() => setSelectedRole('teacher')}
              disabled={isLoading}
              activeOpacity={0.7}
              style={[
                styles.roleCard,
                { borderColor: colors.border, backgroundColor: colors.surface, padding: 12 },
                selectedRole === 'teacher' && { 
                  borderColor: colors.primary, 
                  backgroundColor: colors.primary + '15' 
                },
              ]}
            >
              <View style={[
                styles.roleIconContainer, 
                { backgroundColor: selectedRole === 'teacher' ? colors.primary : colors.surface }
              ]}>
                <Ionicons 
                  name="school" 
                  size={20} 
                  color={selectedRole === 'teacher' ? colors.white : colors.textSecondary} 
                />
              </View>
              <Text style={[
                styles.roleText, 
                { color: selectedRole === 'teacher' ? colors.primary : colors.text, fontSize: 13 }
              ]}>Teacher</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedRole('student')}
              disabled={isLoading}
              activeOpacity={0.7}
              style={[
                styles.roleCard,
                { borderColor: colors.border, backgroundColor: colors.surface, padding: 12 },
                selectedRole === 'student' && { 
                  borderColor: colors.secondary, 
                  backgroundColor: colors.secondary + '15' 
                },
              ]}
            >
              <View style={[
                styles.roleIconContainer, 
                { backgroundColor: selectedRole === 'student' ? colors.secondary : colors.surface }
              ]}>
                <Ionicons 
                  name="person" 
                  size={20} 
                  color={selectedRole === 'student' ? colors.white : colors.textSecondary} 
                />
              </View>
              <Text style={[
                styles.roleText, 
                { color: selectedRole === 'student' ? colors.secondary : colors.text, fontSize: 13 }
              ]}>Student</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedRole('interviewer')}
              disabled={isLoading}
              activeOpacity={0.7}
              style={[
                styles.roleCard,
                { borderColor: colors.border, backgroundColor: colors.surface, padding: 12 },
                selectedRole === 'interviewer' && { 
                  borderColor: colors.success, 
                  backgroundColor: colors.success + '15' 
                },
              ]}
            >
              <View style={[
                styles.roleIconContainer, 
                { backgroundColor: selectedRole === 'interviewer' ? colors.success : colors.surface }
              ]}>
                <Ionicons 
                  name="chatbubbles" 
                  size={20} 
                  color={selectedRole === 'interviewer' ? colors.white : colors.textSecondary} 
                />
              </View>
              <Text style={[
                styles.roleText, 
                { color: selectedRole === 'interviewer' ? colors.success : colors.text, fontSize: 13 }
              ]}>ASR</Text>
            </TouchableOpacity>
          </View>
          {roleError && <Text style={[styles.errorTextSmall, { color: colors.danger }]}>{roleError}</Text>}
        </View>

        <Button
          title="Create Account"
          onPress={handleSubmit}
          loading={isLoading}
          fullWidth
          size="large"
          style={[styles.submitButton, { backgroundColor: colors.secondary }]}
        />
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Already have an account? </Text>
        <TouchableOpacity onPress={onSignInPress} disabled={isLoading}>
          <Text style={[styles.footerLink, { color: colors.primary }]}>Sign in here</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
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
    marginBottom: 24,
    gap: 8,
  },
  roleSection: {
    marginTop: 12,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    marginLeft: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  roleCard: {
    flex: 1,
    padding: 20,
    borderWidth: 2,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  roleIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  errorTextSmall: {
    fontSize: 12,
    marginTop: 8,
    marginLeft: 4,
    fontWeight: '600',
  },
  submitButton: {
    borderRadius: 20,
    height: 60,
    marginTop: 12,
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
    marginTop: 24,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '800',
  },
});
