import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { Notification } from '../types';
import {
  registerForPushNotificationsAsync,
  scheduleLocalNotification,
} from '../utils/pushNotifications';

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotifications: (ids: string[]) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const isStudent = user?.role === 'student' && user?.approved;
  const userId = user?.approved ? user.id : undefined;

  const pushReadyRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isStudent || !userId) return;
    registerForPushNotificationsAsync().then((ok) => {
      pushReadyRef.current = ok;
    });
  }, [isStudent, userId]);

  const handleNewNotification = useCallback(
    async (n: Notification) => {
      if (!n?.id || seenIdsRef.current.has(n.id)) return;
      seenIdsRef.current.add(n.id);

      if (pushReadyRef.current) {
        await scheduleLocalNotification(n.title, n.message);
      }
    },
    []
  );

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh,
    markRead,
    markAllRead,
    deleteNotifications,
  } = useNotifications(userId, handleNewNotification);

  useEffect(() => {
    if (notifications.length > 0) {
      notifications.forEach((n) => seenIdsRef.current.add(n.id));
    }
  }, [notifications]);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh,
    markRead,
    markAllRead,
    deleteNotifications,
  }), [
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh,
    markRead,
    markAllRead,
    deleteNotifications,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return ctx;
};
