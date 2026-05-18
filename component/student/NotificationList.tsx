import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Notification } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface NotificationListProps {
  notifications: Notification[];
  isLoading: boolean;
  onPress: (notification: Notification) => void;
  compact?: boolean;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  isLoading,
  onPress,
  compact = false,
  isSelectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}) => {
  const { colors } = useTheme();

  if (isLoading && notifications.length === 0) {
    return <LoadingSpinner />;
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon="notifications-none"
        title="No notifications"
        message="You will be alerted when marked absent in a class."
      />
    );
  }

  const data = compact ? notifications.slice(0, 3) : notifications;

  const renderRow = (item: Notification) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.row,
          {
            backgroundColor: isSelectionMode && isSelected 
              ? colors.primary + '15' 
              : item.read ? colors.surface : colors.primary + '12',
            borderColor: isSelectionMode && isSelected ? colors.primary : colors.border,
          },
        ]}
        onPress={() => {
          if (isSelectionMode && onToggleSelect) {
            onToggleSelect(item.id);
          } else {
            onPress(item);
          }
        }}
        activeOpacity={0.7}
      >
        {isSelectionMode ? (
          <MaterialIcons 
            name={isSelected ? 'check-circle' : 'radio-button-unchecked'} 
            size={24} 
            color={isSelected ? colors.primary : colors.border} 
            style={{ marginRight: 4 }}
          />
        ) : (
          <View
            style={[
              styles.dot,
              { backgroundColor: item.read ? colors.border : colors.danger },
            ]}
          />
        )}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text
          style={[styles.message, { color: colors.textSecondary }]}
          numberOfLines={compact ? 2 : 4}
        >
          {item.message}
        </Text>
        <Text style={[styles.time, { color: colors.textSecondary }]}>
          {formatTime(item.created_at)}
        </Text>
      </View>
      {!item.read && !isSelectionMode && (
        <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
      )}
      </TouchableOpacity>
    );
  };

  if (compact) {
    return <View style={styles.compactList}>{data.map(renderRow)}</View>;
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => renderRow(item)}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
    />
  );
};

const styles = StyleSheet.create({
  compactList: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    marginTop: 6,
  },
});
