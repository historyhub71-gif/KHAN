import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationService } from '../services/notificationService';
import { Notification } from '../types';
import { supabase } from '../utils/supabase';

export const useNotifications = (
  studentId: string | undefined,
  onNewNotification?: (notification: Notification) => void
) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refresh = useCallback(async () => {
    if (!studentId) return;
    try {
      setIsLoading(true);
      setError(null);
      const [list, count] = await Promise.all([
        notificationService.getForStudent(studentId),
        notificationService.getUnreadCount(studentId),
      ]);
      setNotifications(list);
      setUnreadCount(count);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!studentId) return;
      await notificationService.markRead(notificationId, studentId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    },
    [studentId]
  );

  const markAllRead = useCallback(async () => {
    if (!studentId) return;
    await notificationService.markAllRead(studentId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [studentId]);

  const deleteNotifications = useCallback(async (ids: string[]) => {
    if (!studentId || !ids.length) return;
    // Capture unread count of to-be-deleted items BEFORE the async delete
    setNotifications((prev) => {
      const deletedUnreadCount = prev.filter((n) => ids.includes(n.id) && !n.read).length;
      if (deletedUnreadCount > 0) {
        setUnreadCount((c) => Math.max(0, c - deletedUnreadCount));
      }
      return prev.filter((n) => !ids.includes(n.id));
    });
    await notificationService.deleteNotifications(ids, studentId);
  }, [studentId]);

  const refreshRef = useRef(refresh);
  const onNewNotificationRef = useRef(onNewNotification);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    onNewNotificationRef.current = onNewNotification;
  }, [onNewNotification]);

  useEffect(() => {
    if (!studentId) return;
    refreshRef.current();

    const channel = supabase
      .channel(`notifications:${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && onNewNotificationRef.current) {
            onNewNotificationRef.current(payload.new as Notification);
          }
          refreshRef.current();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [studentId]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh,
    markRead,
    markAllRead,
    deleteNotifications,
  };
};
