-- Migration 008: Add delete_user_by_id SECURITY DEFINER RPC and configure cascade deletion for notifications

-- 1. Modify notifications table constraint to use ON DELETE CASCADE instead of SET NULL
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_teacher_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_teacher_id_fkey
  FOREIGN KEY (teacher_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- 2. Define the delete_user_by_id function to handle course deletion and auth user removal
CREATE OR REPLACE FUNCTION public.delete_user_by_id(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
BEGIN
  -- Check if the executor is indeed an approved admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND approved = true
  ) THEN
    RAISE EXCEPTION 'Access Denied: Only approved admins can delete users.';
  END IF;

  -- Get the role of the user to be deleted
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;

  -- If it's a teacher, clean up their courses first to trigger database cascade deletes
  IF v_role = 'teacher' THEN
    DELETE FROM public.courses WHERE id IN (
      SELECT course_id FROM public.course_teachers WHERE teacher_id = p_user_id
    );
  END IF;

  -- Delete from auth.users which cascade deletes public.profiles and everything else
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

SELECT 'Migration 008 complete: notifications constraint updated and delete_user_by_id RPC defined successfully!' AS status;
