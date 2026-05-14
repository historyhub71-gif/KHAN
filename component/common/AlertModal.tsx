import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    ModalProps,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface AlertModalProps extends Omit<ModalProps, 'visible'> {
  visible: boolean;
  title: string;
  message: string;
  okText?: string;
  cancelText?: string;
  onOk?: () => void;
  onCancel?: () => void;
  isDangerous?: boolean;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  title,
  message,
  okText = 'OK',
  cancelText = 'Cancel',
  onOk,
  onCancel,
  isDangerous = false,
  ...rest
}) => {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" {...rest}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          <MaterialIcons
            name={isDangerous ? 'warning' : 'info'}
            size={40}
            color={isDangerous ? colors.danger : colors.primary}
            style={styles.icon}
          />
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

          <View style={styles.buttons}>
            {onCancel && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.lightGray }]}
                onPress={onCancel}
              >
                <Text style={[styles.cancelText, { color: colors.text }]}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            {onOk && (
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: isDangerous ? colors.danger : colors.primary }
                ]}
                onPress={onOk}
              >
                <Text style={[styles.okText, { color: colors.white }]}>{okText}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  okText: {
    fontWeight: '600',
  },
  cancelText: {
    fontWeight: '600',
  },
});
