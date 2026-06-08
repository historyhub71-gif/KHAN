-- Migration 011: Attendance delete policies and trigger improvements

-- 1. DELETE policies for public.attendance table
DROP POLICY IF EXISTS "Students delete own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers delete course attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins delete all attendance" ON public.attendance;

CREATE POLICY "Students delete own attendance"
ON public.attendance FOR DELETE TO authenticated
USING (
  public.is_student() AND student_id = auth.uid()
);

CREATE POLICY "Teachers delete course attendance"
ON public.attendance FOR DELETE TO authenticated
USING (
  public.is_teacher()
  AND EXISTS (
    SELECT 1 FROM public.course_teachers ct
    WHERE ct.course_id = attendance.course_id
      AND ct.teacher_id = auth.uid()
  )
);

CREATE POLICY "Admins delete all attendance"
ON public.attendance FOR DELETE TO authenticated
USING (public.is_admin());


-- 2. Enable Realtime Replication for attendance table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'attendance'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
    END IF;
  END IF;
END $$;


-- 3. Update notify_student_absence trigger function to delete notification if status becomes present
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
  -- If updated to present, delete any existing absence notification for this record
  IF NEW.status = 'present' THEN
    DELETE FROM public.notifications WHERE attendance_id = NEW.id;
    RETURN NEW;
  END IF;

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

SELECT 'Attendance delete policies and trigger updates applied successfully!' AS status;
