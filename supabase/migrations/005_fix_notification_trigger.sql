-- Fix: notifications not created when student marked absent
-- Run in Supabase SQL Editor (safe to re-run)

-- Simpler trigger (no ON CONFLICT — avoids PG partial-index issues)
CREATE OR REPLACE FUNCTION public.notify_student_absence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  course_name text;
  should_notify boolean := false;
BEGIN
  IF NEW.status <> 'absent' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    should_notify := true;
  ELSIF TG_OP = 'UPDATE' THEN
    should_notify := (OLD.status IS DISTINCT FROM 'absent');
  END IF;

  IF NOT should_notify THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.attendance_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO course_name FROM public.courses WHERE id = NEW.course_id;

  INSERT INTO public.notifications (
    student_id, teacher_id, course_id, attendance_id, title, message
  ) VALUES (
    NEW.student_id,
    NEW.teacher_id,
    NEW.course_id,
    NEW.id,
    'Attendance Alert',
    'You were marked absent today in ' || COALESCE(course_name, 'your course') || '.'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_absence ON public.attendance;
CREATE TRIGGER trg_notify_student_absence
  AFTER INSERT OR UPDATE OF status ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_student_absence();

-- Admin can insert (backfill / support)
DROP POLICY IF EXISTS "Admins insert notifications" ON public.notifications;
CREATE POLICY "Admins insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

-- Backfill missing notifications for existing absent rows
INSERT INTO public.notifications (
  student_id, teacher_id, course_id, attendance_id, title, message
)
SELECT
  a.student_id,
  a.teacher_id,
  a.course_id,
  a.id,
  'Attendance Alert',
  'You were marked absent today in ' || COALESCE(c.name, 'your course') || '.'
FROM public.attendance a
LEFT JOIN public.courses c ON c.id = a.course_id
WHERE a.status = 'absent'
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n WHERE n.attendance_id = a.id
  );

SELECT COUNT(*) AS total_notifications FROM public.notifications;
