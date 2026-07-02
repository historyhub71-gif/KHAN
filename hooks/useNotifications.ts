import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationService } from '../services/notificationService';
import { Notification } from '../types';
import { supabase } from '../utils/supabase';

export const useNotifications = (
  userId: string | undefined,
  onNewNotification?: (notification: Notification) => void
) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setIsLoading(true);
      setError(null);
      const [list, count] = await Promise.all([
        notificationService.getForUser(userId),
        notificationService.getUnreadCount(userId),
      ]);
      setNotifications(list);
      setUnreadCount(count);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;
      await notificationService.markRead(notificationId, userId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    },
    [userId]
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await notificationService.markAllRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [userId]);

  const deleteNotifications = useCallback(async (ids: string[]) => {
    if (!userId || !ids.length) return;
    // Capture unread count of to-be-deleted items BEFORE the async delete
    setNotifications((prev) => {
      const deletedUnreadCount = prev.filter((n) => ids.includes(n.id) && !n.read).length;
      if (deletedUnreadCount > 0) {
        setUnreadCount((c) => Math.max(0, c - deletedUnreadCount));
      }
      return prev.filter((n) => !ids.includes(n.id));
    });
    await notificationService.deleteNotifications(ids, userId);
  }, [userId]);

  const refreshRef = useRef(refresh);
  const onNewNotificationRef = useRef(onNewNotification);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    onNewNotificationRef.current = onNewNotification;
  }, [onNewNotification]);

  useEffect(() => {
    if (!userId) return;
    refreshRef.current();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
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
  }, [userId]);

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
