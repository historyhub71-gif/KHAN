-- Attendance alerts & analytics migration
-- Run in Supabase SQL Editor after base schema (student_attendance_supabase_sql_v2.txt)

-- ---------------------------------------------------------------------------
-- 1. Attendance unique constraint + indexes
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_course_student_date_unique'
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_course_student_date_unique
      UNIQUE (course_id, student_id, date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_course_date
  ON public.attendance (course_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_student
  ON public.attendance (student_id);

-- ---------------------------------------------------------------------------
-- 2. Helper: is_student()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'student'
      AND approved = true
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Notifications table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  attendance_id uuid REFERENCES public.attendance(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Attendance Alert',
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_student_read
  ON public.notifications (student_id, read);

CREATE INDEX IF NOT EXISTS idx_notifications_student_created
  ON public.notifications (student_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_attendance_unique
  ON public.notifications (attendance_id)
  WHERE attendance_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Trigger: notify student when marked absent
-- ---------------------------------------------------------------------------
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
    student_id,
    teacher_id,
    course_id,
    attendance_id,
    title,
    message
  ) VALUES (
    NEW.student_id,
    NEW.teacher_id,
    NEW.course_id,
    NEW.id,
    'Attendance Alert',
    'You were marked absent today in ' || COALESCE(course_name, 'your course') || '.'
  )
  ON CONFLICT (attendance_id) WHERE attendance_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_absence ON public.attendance;

CREATE TRIGGER trg_notify_student_absence
  AFTER INSERT OR UPDATE OF status ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_student_absence();

-- ---------------------------------------------------------------------------
-- 5. RLS: tighten attendance SELECT + notifications
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop broad attendance read policy
DROP POLICY IF EXISTS "Users can view attendance" ON public.attendance;

CREATE POLICY "Students view own attendance"
ON public.attendance FOR SELECT TO authenticated
USING (
  public.is_student() AND student_id = auth.uid()
);

CREATE POLICY "Teachers view course attendance"
ON public.attendance FOR SELECT TO authenticated
USING (
  public.is_teacher()
  AND EXISTS (
    SELECT 1 FROM public.course_teachers ct
    WHERE ct.course_id = attendance.course_id
      AND ct.teacher_id = auth.uid()
  )
);

CREATE POLICY "Admins view all attendance"
ON public.attendance FOR SELECT TO authenticated
USING (public.is_admin());

-- Notifications policies
DROP POLICY IF EXISTS "Students read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Students update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Teachers read course notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins read all notifications" ON public.notifications;

CREATE POLICY "Students read own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Students update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers read course notifications"
ON public.notifications FOR SELECT TO authenticated
USING (
  public.is_teacher()
  AND EXISTS (
    SELECT 1 FROM public.course_teachers ct
    WHERE ct.course_id = notifications.course_id
      AND ct.teacher_id = auth.uid()
  )
);

CREATE POLICY "Admins read all notifications"
ON public.notifications FOR SELECT TO authenticated
USING (public.is_admin());

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

-- RPC fallback (SECURITY DEFINER) when client insert is blocked
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

-- ---------------------------------------------------------------------------
-- 6. Realtime (enable notifications in publication)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END $$;
