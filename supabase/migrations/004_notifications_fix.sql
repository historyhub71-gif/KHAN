-- Run this if notifications still do not appear after marking absent.
-- Safe to run multiple times.

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_attendance_unique
  ON public.notifications (attendance_id)
  WHERE attendance_id IS NOT NULL;

DROP POLICY IF EXISTS "Teachers insert absence notifications" ON public.notifications;

CREATE POLICY "Teachers insert absence notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  public.is_teacher()
  AND teacher_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.course_teachers ct
    WHERE ct.course_id = notifications.course_id
      AND ct.teacher_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.course_students cs
    WHERE cs.course_id = notifications.course_id
      AND cs.student_id = notifications.student_id
  )
);

CREATE OR REPLACE FUNCTION public.create_absence_notification(
  p_student_id uuid,
  p_teacher_id uuid,
  p_course_id uuid,
  p_attendance_id uuid,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_teacher_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.course_teachers
    WHERE course_id = p_course_id AND teacher_id = p_teacher_id
  ) THEN
    RAISE EXCEPTION 'Teacher not assigned to this course';
  END IF;

  INSERT INTO public.notifications (
    student_id, teacher_id, course_id, attendance_id, title, message
  ) VALUES (
    p_student_id, p_teacher_id, p_course_id, p_attendance_id,
    'Attendance Alert', p_message
  )
  ON CONFLICT (attendance_id) WHERE attendance_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_absence_notification(uuid, uuid, uuid, uuid, text)
  TO authenticated;

-- Re-create trigger function with dedup
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

  SELECT name INTO course_name FROM public.courses WHERE id = NEW.course_id;

  INSERT INTO public.notifications (
    student_id, teacher_id, course_id, attendance_id, title, message
  ) VALUES (
    NEW.student_id, NEW.teacher_id, NEW.course_id, NEW.id,
    'Attendance Alert',
    'You were marked absent today in ' || COALESCE(course_name, 'your course') || '.'
  )
  ON CONFLICT (attendance_id) WHERE attendance_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;
