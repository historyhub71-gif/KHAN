-- =============================================================================
-- HASHIR KHAN ATTENDANCE APP — COMPLETE SUPABASE SETUP (SAFE TO RE-RUN)
-- Project: hevtjydsogadszcwdhhn
-- Paste in Supabase Dashboard → SQL Editor → Run
-- Or: node scripts/apply-supabase-sql.js YOUR_DATABASE_PASSWORD
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLES (skip if already exist)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text UNIQUE,
  role text CHECK (role IN ('admin', 'teacher', 'student')),
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  code text UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.course_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text CHECK (status IN ('present', 'absent')),
  date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  attendance_id uuid REFERENCES public.attendance(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Attendance Alert',
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- INDEXES & CONSTRAINTS
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_course_student_date_unique'
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_course_student_date_unique
      UNIQUE (course_id, student_id, date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_course_date ON public.attendance (course_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_student_read ON public.notifications (student_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_student_created ON public.notifications (student_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_attendance_unique
  ON public.notifications (attendance_id) WHERE attendance_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher' AND approved = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND approved = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'student' AND approved = true
  );
$$;

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

-- -----------------------------------------------------------------------------
-- REGISTRATION PROFILE TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, approved, status)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'User'),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    false,
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- ABSENCE NOTIFICATION TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_student_absence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  course_name text;
  should_notify boolean := false;
BEGIN
  IF NEW.status <> 'absent' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN should_notify := true;
  ELSIF TG_OP = 'UPDATE' THEN should_notify := (OLD.status IS DISTINCT FROM 'absent');
  END IF;
  IF NOT should_notify THEN RETURN NEW; END IF;

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

DROP TRIGGER IF EXISTS trg_notify_student_absence ON public.attendance;
CREATE TRIGGER trg_notify_student_absence
  AFTER INSERT OR UPDATE OF status ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.notify_student_absence();

-- RPC for app when teacher marks absent
CREATE OR REPLACE FUNCTION public.create_absence_notification(
  p_student_id uuid,
  p_teacher_id uuid,
  p_course_id uuid,
  p_attendance_id uuid,
  p_message text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
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

GRANT EXECUTE ON FUNCTION public.create_absence_notification(uuid, uuid, uuid, uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- ENABLE RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- PROFILES POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own profile or admin/teacher" ON public.profiles;
DROP POLICY IF EXISTS "Students can view teacher profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Only admin can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admin can delete profiles" ON public.profiles;

CREATE POLICY "Users can read own profile or admin/teacher" ON public.profiles
  FOR SELECT TO authenticated USING (
    id = auth.uid() OR public.is_admin() OR public.is_teacher()
  );
CREATE POLICY "Students can view teacher profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    role = 'teacher' AND approved = true
  );
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Only admin can update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Only admin can delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- COURSES POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view courses" ON public.courses;
DROP POLICY IF EXISTS "Only admin can insert courses" ON public.courses;
DROP POLICY IF EXISTS "Only admin can update courses" ON public.courses;
DROP POLICY IF EXISTS "Only admin can delete courses" ON public.courses;

CREATE POLICY "Users can view courses" ON public.courses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true));
CREATE POLICY "Only admin can insert courses" ON public.courses FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Only admin can update courses" ON public.courses FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Only admin can delete courses" ON public.courses FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- COURSE_TEACHERS POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view course_teachers" ON public.course_teachers;
DROP POLICY IF EXISTS "Only admin can insert course_teachers" ON public.course_teachers;
DROP POLICY IF EXISTS "Only admin can update course_teachers" ON public.course_teachers;
DROP POLICY IF EXISTS "Only admin can delete course_teachers" ON public.course_teachers;

CREATE POLICY "Users can view course_teachers" ON public.course_teachers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true));
CREATE POLICY "Only admin can insert course_teachers" ON public.course_teachers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Only admin can update course_teachers" ON public.course_teachers FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Only admin can delete course_teachers" ON public.course_teachers FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- COURSE_STUDENTS POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view course_students" ON public.course_students;
DROP POLICY IF EXISTS "Only admin can insert course_students" ON public.course_students;
DROP POLICY IF EXISTS "Only admin can update course_students" ON public.course_students;
DROP POLICY IF EXISTS "Only admin can delete course_students" ON public.course_students;

CREATE POLICY "Users can view course_students" ON public.course_students FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true));
CREATE POLICY "Only admin can insert course_students" ON public.course_students FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Only admin can update course_students" ON public.course_students FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Only admin can delete course_students" ON public.course_students FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- ATTENDANCE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers view course attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Only teacher can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Only teacher can update attendance" ON public.attendance;

CREATE POLICY "Students view own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (public.is_student() AND student_id = auth.uid());
CREATE POLICY "Teachers view course attendance" ON public.attendance FOR SELECT TO authenticated
  USING (
    public.is_teacher() AND EXISTS (
      SELECT 1 FROM public.course_teachers ct
      WHERE ct.course_id = attendance.course_id AND ct.teacher_id = auth.uid()
    )
  );
CREATE POLICY "Admins view all attendance" ON public.attendance FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Only teacher can insert attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND approved = true AND role = 'teacher'
    )
  );
CREATE POLICY "Only teacher can update attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND approved = true AND role = 'teacher'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND approved = true AND role = 'teacher'
    )
  );

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Students update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Students delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Teachers read course notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins read all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins delete all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Teachers insert absence notifications" ON public.notifications;

CREATE POLICY "Students read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "Students update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students delete own notifications" ON public.notifications FOR DELETE TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "Teachers read course notifications" ON public.notifications FOR SELECT TO authenticated
  USING (
    public.is_teacher() AND EXISTS (
      SELECT 1 FROM public.course_teachers ct
      WHERE ct.course_id = notifications.course_id AND ct.teacher_id = auth.uid()
    )
  );
CREATE POLICY "Admins read all notifications" ON public.notifications FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admins delete all notifications" ON public.notifications FOR DELETE TO authenticated
  USING (public.is_admin());
CREATE POLICY "Teachers insert absence notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.is_teacher()
    AND teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.course_teachers ct
      WHERE ct.course_id = notifications.course_id AND ct.teacher_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.course_students cs
      WHERE cs.course_id = notifications.course_id AND cs.student_id = notifications.student_id
    )
  );

-- -----------------------------------------------------------------------------
-- REALTIME
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END $$;

-- Done
SELECT 'Setup complete. notifications table ready.' AS status;
