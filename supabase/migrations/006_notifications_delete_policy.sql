-- Migration 006: Add DELETE policies for notifications
-- Allows students to delete their own notifications, and admins to delete all notifications.

DROP POLICY IF EXISTS "Students delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins delete all notifications" ON public.notifications;

CREATE POLICY "Students delete own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Admins delete all notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (public.is_admin());

SELECT 'Notifications delete policies added successfully!' AS status;
