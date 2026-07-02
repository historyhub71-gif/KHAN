import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { NotificationList } from '../../component/student/NotificationList';
import { useNotificationContext } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { Notification } from '../../types';

export default function StudentNotificationsScreen() {
  const { colors } = useTheme();
  const {
    notifications,
    isLoading,
    error,
    refresh,
    markRead,
    markAllRead,
    unreadCount,
    deleteNotifications,
  } = useNotificationContext();

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handlePress = async (item: Notification) => {
    if (!item.read) {
      await markRead(item.id);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    try {
      if (selectedIds.size === 0) return;

      await deleteNotifications(Array.from(selectedIds));
      await refresh();

      setIsSelectionMode(false);
      setSelectedIds(new Set());

    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const header = (
    <View style={[styles.headerWrapper, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <View style={styles.headerActions}>
          {isSelectionMode ? (
            <>
              <TouchableOpacity onPress={toggleSelectAll} style={styles.headerButton}>
                <Text style={[styles.headerButtonText, { color: colors.primary }]}>
                  {selectedIds.size === notifications.length && notifications.length > 0 ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleSelectionMode} style={styles.headerButton}>
                <Text style={[styles.headerButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={markAllRead}
                  style={[styles.markAll, { backgroundColor: colors.primary + '15' }]}
                >
                  <MaterialIcons name="done-all" size={18} color={colors.primary} />
                  <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all read</Text>
                </TouchableOpacity>
              )}
              {notifications.length > 0 && (
                <TouchableOpacity onPress={toggleSelectionMode} style={styles.headerButton}>
                  <Text style={[styles.headerButtonText, { color: colors.primary }]}>Select</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      ) : null}
    </View>
  );

  return (
    <ScreenContainer>
      <NotificationList
        notifications={notifications}
        isLoading={isLoading}
        onPress={handlePress}
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        listStyle={{ backgroundColor: colors.background, paddingHorizontal: 16 }}
        listHeader={header}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} />
        }
      />
      {isSelectionMode && selectedIds.size > 0 && (
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.selectedText, { color: colors.text }]}>
            {selectedIds.size} selected
          </Text>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: colors.danger }]}
            onPress={handleDeleteSelected}
          >
            <MaterialIcons name="delete" size={20} color="#fff" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    marginBottom: 12,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
