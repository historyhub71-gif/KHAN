import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Profile } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { EmptyState } from '../common/EmptyState';

interface UserListProps {
  users: Profile[];
  isLoading: boolean;
  onUserPress?: (user: Profile) => void;
  onDeletePress?: (userId: string) => void;
  onApprovePress?: (userId: string) => void;
  onDisapprovePress?: (userId: string) => void;
}

export const UserList: React.FC<UserListProps> = ({
  users,
  isLoading,
  onUserPress,
  onDeletePress,
  onApprovePress,
  onDisapprovePress,
}) => {
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (users.length === 0) {
    return <EmptyState title="No Users" message="No users found" />;
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => onUserPress?.(item)}
          activeOpacity={0.7}
        >
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
              {!item.approved && (
                <View style={[styles.pendingBadge, { backgroundColor: colors.warning + '15' }]}>
                  <Text style={[styles.pendingBadgeText, { color: colors.warning }]}>Pending</Text>
                </View>
              )}
            </View>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{item.email}</Text>
            <View style={[styles.roleLabel, { backgroundColor: colors.background }]}>
              <Text style={[styles.roleLabelText, { color: colors.textSecondary }]}>
                {item.role?.toUpperCase() || 'USER'}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            {!item.approved && onApprovePress && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success + '10' }]}
                onPress={() => onApprovePress(item.id)}
              >
                <MaterialIcons
                  name="check"
                  size={20}
                  color={colors.success}
                />
              </TouchableOpacity>
            )}

            {item.approved && onDisapprovePress && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.warning + '10' }]}
                onPress={() => onDisapprovePress(item.id)}
              >
                <MaterialIcons
                  name="block"
                  size={18}
                  color={colors.warning}
                />
              </TouchableOpacity>
            )}

            {onDeletePress && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.danger + '10' }]}
                onPress={() => onDeletePress(item.id)}
              >
                <MaterialIcons name="delete-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.listContainer}
    />
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingVertical: 8,
  },
  userCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 13,
    marginBottom: 8,
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  roleLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleLabelText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
