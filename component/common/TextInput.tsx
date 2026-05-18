import React, { useState, useEffect } from 'react';
import {
    TextInput as RNTextInput,
    StyleSheet,
    Text,
    TextInputProps,
    View,
    ViewStyle,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const TextInput: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  leftIcon,
  rightIcon,
  secureTextEntry,
  ...rest
}) => {
  const { colors } = useTheme();
  const [isSecure, setIsSecure] = useState(secureTextEntry);

  // Synchronize state if secureTextEntry prop changes from parent
  useEffect(() => {
    setIsSecure(secureTextEntry);
  }, [secureTextEntry]);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
      <View style={[
        styles.inputContainer,
        { 
          borderColor: colors.border, 
          backgroundColor: colors.surface,
          borderWidth: 1,
        },
        error ? { borderColor: colors.danger } : null,
      ]}>
        {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
        <RNTextInput
          style={[
            styles.input, 
            { color: colors.text },
          ]}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={isSecure}
          {...rest}
        />
        {rightIcon ? (
          <View style={styles.iconContainerRight}>{rightIcon}</View>
        ) : secureTextEntry !== undefined ? (
          <TouchableOpacity
            onPress={() => setIsSecure(prev => !prev)}
            activeOpacity={0.6}
            style={styles.eyeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isSecure ? "eye-off" : "eye"}
              size={22}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerRight: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeButton: {
    marginLeft: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
});
