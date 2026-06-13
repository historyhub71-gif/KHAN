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
  role text CHECK (role IN ('admin', 'teacher', 'student', 'interviewer', 'director')),
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

-- =============================================================================
-- HASHIR KHAN ATTENDANCE APP — NEW FEATURES SCHEMA MIGRATION (012)
-- Paste in Supabase Dashboard → SQL Editor → Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ROLE CONSTRAINT ALTERATION & RLS HELPERS
-- -----------------------------------------------------------------------------

-- Drop old role constraint dynamically if exists and apply updated constraints
DO $$
DECLARE
    rname text;
BEGIN
    SELECT conname INTO rname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass AND contype = 'c' AND conname LIKE '%role%';
    IF rname IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(rname);
    END IF;
END $$;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'teacher', 'student', 'interviewer', 'director'));

CREATE OR REPLACE FUNCTION public.is_interviewer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'interviewer' AND approved = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_director()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'director' AND approved = true
  );
$$;

-- Alter existing notifications table to drop NOT NULL course/student constraints
ALTER TABLE public.notifications ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN course_id DROP NOT NULL;

-- Append notification schema updates safely
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS notification_type text 
  CHECK (notification_type IN (
    'Monthly Fee Due Reminder', 
    'Fee Overdue Reminder', 
    'Payment Received Confirmation', 
    'Fee Approval/Rejection Notification', 
    'Attendance Alert',
    'interview_completed',
    'progress_review_due',
    'payment_approved',
    'payment_rejected'
  ));
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('read', 'unread')) DEFAULT 'unread';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sent_at timestamptz DEFAULT now();

-- -----------------------------------------------------------------------------
-- 2. PROFILE 1:1 EXTENSION TABLES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  level text CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interviewer_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. INTERVIEWS & SCORE DETAILS (Combined into single interviews table)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  interview_type text CHECK (interview_type IN ('admission', 'progress_review')) NOT NULL,
  notes text,
  english numeric CHECK (english >= 0 AND english <= 10),
  communication numeric CHECK (communication >= 0 AND communication <= 10),
  confidence numeric CHECK (confidence >= 0 AND confidence <= 10),
  technical_skills numeric CHECK (technical_skills >= 0 AND technical_skills <= 10),
  learning_ability numeric CHECK (learning_ability >= 0 AND learning_ability <= 10),
  total_score numeric DEFAULT 0,
  assigned_level text CHECK (assigned_level IN ('Beginner', 'Intermediate', 'Advanced')),
  strengths text,
  weaknesses text,
  recommendations text,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_progress_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admission_interview_id uuid REFERENCES public.interviews(id) ON DELETE SET NULL,
  review_interview_id uuid REFERENCES public.interviews(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  completed_at timestamptz,
  growth_report text,
  improvement_percentage numeric,
  created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. FEE MANAGEMENT
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  due_date date NOT NULL,
  status text CHECK (status IN ('unpaid', 'pending', 'approved', 'rejected')) DEFAULT 'unpaid',
  payment_method text CHECK (payment_method IN ('Cash', 'Card', 'Bank Transfer', 'Mobile Wallet', 'None')) DEFAULT 'None',
  payment_date timestamptz,
  notes text,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason text,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fee_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE REFERENCES public.fee_payments(id) ON DELETE CASCADE,
  receipt_number text UNIQUE NOT NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 5. TEACHER ATTENDANCE, SALARIES, AND DEDUCTIONS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in time,
  check_out time,
  status text CHECK (status IN ('present', 'absent', 'late')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (teacher_id, date)
);

CREATE TABLE IF NOT EXISTS public.teacher_salary_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  monthly_salary numeric NOT NULL CHECK (monthly_salary >= 0),
  working_days integer NOT NULL CHECK (working_days > 0),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.salary_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  base_salary numeric NOT NULL,
  working_days integer NOT NULL,
  actual_absences integer NOT NULL DEFAULT 0,
  total_lates integer NOT NULL DEFAULT 0,
  effective_absences numeric NOT NULL DEFAULT 0,
  deduction_amount numeric NOT NULL DEFAULT 0,
  final_salary numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (teacher_id, month, year)
);

-- -----------------------------------------------------------------------------
-- 6. PERSISTENT NOTIFICATION HISTORY & AUDIT LOGS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text,
  notification_type text,
  title text,
  message text,
  status text CHECK (status IN ('read', 'unread')) DEFAULT 'unread',
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 7. INDEXES FOR PERFORMANCE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_student_profiles_teacher ON public.student_profiles (assigned_teacher_id);
CREATE INDEX IF NOT EXISTS idx_interviews_student ON public.interviews (student_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_interviews_type ON public.interviews (interview_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON public.fee_payments (student_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fee_payments_due ON public.fee_payments (due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date ON public.teacher_attendance (teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_salary_settings_effective ON public.teacher_salary_settings (teacher_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications (user_id, status);

-- -----------------------------------------------------------------------------
-- 8. ENABLE ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_salary_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 9. RLS POLICIES DEFINITIONS
-- -----------------------------------------------------------------------------

-- student_profiles policies
DROP POLICY IF EXISTS "Students view own profile details" ON public.student_profiles;
CREATE POLICY "Students view own profile details" ON public.student_profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Teachers and Interviewers view student details" ON public.student_profiles;
CREATE POLICY "Teachers and Interviewers view student details" ON public.student_profiles
  FOR SELECT TO authenticated USING (public.is_teacher() OR public.is_interviewer() OR public.is_admin());

DROP POLICY IF EXISTS "Admin manage student details" ON public.student_profiles;
CREATE POLICY "Admin manage student details" ON public.student_profiles
  FOR ALL TO authenticated USING (public.is_admin());

-- teacher_profiles policies
DROP POLICY IF EXISTS "Teachers read own profiles" ON public.teacher_profiles;
CREATE POLICY "Teachers read own profiles" ON public.teacher_profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admin manage teacher profiles" ON public.teacher_profiles;
CREATE POLICY "Admin manage teacher profiles" ON public.teacher_profiles
  FOR ALL TO authenticated USING (public.is_admin());

-- interviewer_profiles policies
DROP POLICY IF EXISTS "Interviewers read own profiles" ON public.interviewer_profiles;
CREATE POLICY "Interviewers read own profiles" ON public.interviewer_profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admin manage interviewer profiles" ON public.interviewer_profiles;
CREATE POLICY "Admin manage interviewer profiles" ON public.interviewer_profiles
  FOR ALL TO authenticated USING (public.is_admin());

-- interviews policies
DROP POLICY IF EXISTS "Students read own interviews" ON public.interviews;
CREATE POLICY "Students read own interviews" ON public.interviews
  FOR SELECT TO authenticated USING (student_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Teachers read interviews of assigned students" ON public.interviews;
CREATE POLICY "Teachers read interviews of assigned students" ON public.interviews
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.id = interviews.student_id AND sp.assigned_teacher_id = auth.uid()
    ) AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Interviewers manage all interviews" ON public.interviews;
CREATE POLICY "Interviewers manage all interviews" ON public.interviews
  FOR ALL TO authenticated USING (public.is_interviewer() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admin manage all interviews" ON public.interviews;
CREATE POLICY "Admin manage all interviews" ON public.interviews
  FOR ALL TO authenticated USING (public.is_admin());

-- student_progress_reviews policies
DROP POLICY IF EXISTS "Students read own reviews" ON public.student_progress_reviews;
CREATE POLICY "Students read own reviews" ON public.student_progress_reviews
  FOR SELECT TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers and Interviewers view reviews" ON public.student_progress_reviews;
CREATE POLICY "Teachers and Interviewers view reviews" ON public.student_progress_reviews
  FOR SELECT TO authenticated USING (public.is_teacher() OR public.is_interviewer() OR public.is_admin());

DROP POLICY IF EXISTS "Interviewers insert and update reviews" ON public.student_progress_reviews;
CREATE POLICY "Interviewers insert and update reviews" ON public.student_progress_reviews
  FOR ALL TO authenticated USING (public.is_interviewer() OR public.is_admin());

-- fee_payments policies
DROP POLICY IF EXISTS "Students read own fee payments" ON public.fee_payments;
CREATE POLICY "Students read own fee payments" ON public.fee_payments
  FOR SELECT TO authenticated USING (student_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Teachers read and insert fee payments for assigned students" ON public.fee_payments;
CREATE POLICY "Teachers read and insert fee payments for assigned students" ON public.fee_payments
  FOR ALL TO authenticated USING (
    (
      EXISTS (
        SELECT 1 FROM public.student_profiles sp
        WHERE sp.id = fee_payments.student_id AND sp.assigned_teacher_id = auth.uid()
      ) OR student_id = auth.uid()
    ) AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Admin manage all fee payments" ON public.fee_payments;
CREATE POLICY "Admin manage all fee payments" ON public.fee_payments
  FOR ALL TO authenticated USING (public.is_admin());

-- fee_receipts policies
DROP POLICY IF EXISTS "Students read own receipts" ON public.fee_receipts;
CREATE POLICY "Students read own receipts" ON public.fee_receipts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.fee_payments fp
      WHERE fp.id = fee_receipts.payment_id AND fp.student_id = auth.uid()
    ) AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Teachers read receipts for assigned students" ON public.fee_receipts;
CREATE POLICY "Teachers read receipts for assigned students" ON public.fee_receipts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.fee_payments fp
      JOIN public.student_profiles sp ON sp.id = fp.student_id
      WHERE fp.id = fee_receipts.payment_id AND sp.assigned_teacher_id = auth.uid()
    ) AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Admin manage all receipts" ON public.fee_receipts;
CREATE POLICY "Admin manage all receipts" ON public.fee_receipts
  FOR ALL TO authenticated USING (public.is_admin());

-- teacher_attendance policies
DROP POLICY IF EXISTS "Teachers log own attendance" ON public.teacher_attendance;
CREATE POLICY "Teachers log own attendance" ON public.teacher_attendance
  FOR ALL TO authenticated USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Admin manage teacher attendance" ON public.teacher_attendance;
CREATE POLICY "Admin manage teacher attendance" ON public.teacher_attendance
  FOR ALL TO authenticated USING (public.is_admin());

-- teacher_salary_settings policies
DROP POLICY IF EXISTS "Teachers view own salary settings" ON public.teacher_salary_settings;
CREATE POLICY "Teachers view own salary settings" ON public.teacher_salary_settings
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Admin manage salary settings" ON public.teacher_salary_settings;
CREATE POLICY "Admin manage salary settings" ON public.teacher_salary_settings
  FOR ALL TO authenticated USING (public.is_admin());

-- salary_deductions policies
DROP POLICY IF EXISTS "Teachers view own deductions log" ON public.salary_deductions;
CREATE POLICY "Teachers view own deductions log" ON public.salary_deductions
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Admin manage salary deductions" ON public.salary_deductions;
CREATE POLICY "Admin manage salary deductions" ON public.salary_deductions
  FOR ALL TO authenticated USING (public.is_admin());

-- notification_history policies
DROP POLICY IF EXISTS "Students read own notification history" ON public.notification_history;
CREATE POLICY "Students read own notification history" ON public.notification_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin manage notification history" ON public.notification_history;
CREATE POLICY "Admin manage notification history" ON public.notification_history
  FOR ALL TO authenticated USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 10. DATABASE TRIGGERS
-- -----------------------------------------------------------------------------

-- Trigger 1: Total Interview Score & Auto-Level Calculation
CREATE OR REPLACE FUNCTION public.calculate_interview_total()
RETURNS trigger AS $$
BEGIN
  NEW.total_score := COALESCE(NEW.english, 0) + 
                     COALESCE(NEW.communication, 0) + 
                     COALESCE(NEW.confidence, 0) + 
                     COALESCE(NEW.technical_skills, 0) + 
                     COALESCE(NEW.learning_ability, 0);

  IF NEW.total_score >= 40 THEN
    NEW.assigned_level := 'Advanced';
  ELSIF NEW.total_score >= 25 THEN
    NEW.assigned_level := 'Intermediate';
  ELSE
    NEW.assigned_level := 'Beginner';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_interview_total ON public.interviews;
CREATE TRIGGER trg_calculate_interview_total
  BEFORE INSERT OR UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.calculate_interview_total();

-- Trigger 2: Automatic Progress Review Scheduling (14 Days)
CREATE OR REPLACE FUNCTION public.auto_schedule_progress_review()
RETURNS trigger AS $$
BEGIN
  IF NEW.interview_type = 'admission' AND NEW.deleted_at IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.student_progress_reviews
      WHERE student_id = NEW.student_id AND admission_interview_id = NEW.id
    ) THEN
      INSERT INTO public.student_progress_reviews (student_id, admission_interview_id, scheduled_date)
      VALUES (NEW.student_id, NEW.id, (COALESCE(NEW.created_at, now())::date + INTERVAL '14 days')::date);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_schedule_progress_review ON public.interviews;
CREATE TRIGGER trg_auto_schedule_progress_review
  AFTER INSERT OR UPDATE OF total_score ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.auto_schedule_progress_review();

-- Trigger 3: Automatic Receipt Code Generator (RCPT-YYYY-000001)
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS trigger AS $$
DECLARE
  v_year text;
  v_prefix text;
  v_next_seq integer;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_prefix := 'RCPT-' || v_year || '-';
  
  SELECT COALESCE(MAX(SUBSTRING(receipt_number FROM 11)::integer), 0) + 1
  INTO v_next_seq
  FROM public.fee_receipts
  WHERE receipt_number LIKE v_prefix || '%';
  
  NEW.receipt_number := v_prefix || lpad(v_next_seq::text, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_receipt_number ON public.fee_receipts;
CREATE TRIGGER trg_generate_receipt_number
  BEFORE INSERT ON public.fee_receipts
  FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_number();

-- Trigger 4: Backward-Compatible Notification Syncing
CREATE OR REPLACE FUNCTION public.sync_notification_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.student_id IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.user_id := NEW.student_id;
  ELSIF NEW.user_id IS NOT NULL AND NEW.student_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND role = 'student') THEN
      NEW.student_id := NEW.user_id;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := CASE WHEN NEW.read = true THEN 'read' ELSE 'unread' END;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.read IS DISTINCT FROM NEW.read THEN
      NEW.status := CASE WHEN NEW.read = true THEN 'read' ELSE 'unread' END;
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.read := CASE WHEN NEW.status = 'read' THEN true ELSE false END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_notification_status ON public.notifications;
CREATE TRIGGER trg_sync_notification_status
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_notification_status();

-- Trigger 5: Log notification details into history automatically
CREATE OR REPLACE FUNCTION public.log_notification_history()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notification_history (notification_id, user_id, role, notification_type, title, message, status, created_at, sent_at)
  VALUES (NEW.id, NEW.user_id, NEW.role, NEW.notification_type, NEW.title, NEW.message, NEW.status, NEW.created_at, NEW.sent_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_notification_history ON public.notifications;
CREATE TRIGGER trg_log_notification_history
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.log_notification_history();

-- -----------------------------------------------------------------------------
-- 11. AUDIT LOGGING TRIGGERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS trigger AS $$
DECLARE
  v_old jsonb := null;
  v_new jsonb := null;
  v_record_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_record_id := OLD.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id;
  ELSE
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id;
  END IF;

  INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, old_data, new_data)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_old, v_new);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit log triggers to fee_payments and salary_settings
DROP TRIGGER IF EXISTS trg_audit_fee_payments ON public.fee_payments;
CREATE TRIGGER trg_audit_fee_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS trg_audit_salary_settings ON public.teacher_salary_settings;
CREATE TRIGGER trg_audit_salary_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.teacher_salary_settings
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- =============================================================================
-- ATTENDANCE APP — ADMISSION FEE MANAGEMENT SCHEMA (013 ADDITION)
-- =============================================================================

-- 1. ADMISSION DEALS TABLE
CREATE TABLE IF NOT EXISTS public.admission_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  original_fee numeric NOT NULL CHECK (original_fee >= 0),
  discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0),
  discount_percentage numeric DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  final_fee numeric NOT NULL CHECK (final_fee >= 0),
  payment_status text CHECK (payment_status IN ('pending', 'paid')) DEFAULT 'pending',
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. ADMISSION DISCOUNTS LOG TABLE
CREATE TABLE IF NOT EXISTS public.admission_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.admission_deals(id) ON DELETE CASCADE,
  discount_amount numeric NOT NULL CHECK (discount_amount >= 0),
  discount_percentage numeric NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  remarks text,
  created_at timestamptz DEFAULT now()
);

-- 3. FEE AGREEMENTS LOG TABLE
CREATE TABLE IF NOT EXISTS public.fee_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.admission_deals(id) ON DELETE CASCADE,
  agreed_amount numeric NOT NULL CHECK (agreed_amount >= 0),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 4. PAYMENT STATUS TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.payment_status_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.admission_deals(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'paid')),
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.admission_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_status_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies Definitions

-- admission_deals policies
DROP POLICY IF EXISTS "Admins have full access to admission_deals" ON public.admission_deals;
CREATE POLICY "Admins have full access to admission_deals"
  ON public.admission_deals FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers and Interviewers have select access to admission_deals" ON public.admission_deals;
CREATE POLICY "Teachers and Interviewers have select access to admission_deals"
  ON public.admission_deals FOR SELECT TO authenticated
  USING (public.is_teacher() OR public.is_interviewer() OR public.is_admin());

-- admission_discounts policies
DROP POLICY IF EXISTS "Admins have full access to admission_discounts" ON public.admission_discounts;
CREATE POLICY "Admins have full access to admission_discounts"
  ON public.admission_discounts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers and Interviewers have select access to admission_discounts" ON public.admission_discounts;
CREATE POLICY "Teachers and Interviewers have select access to admission_discounts"
  ON public.admission_discounts FOR SELECT TO authenticated
  USING (public.is_teacher() OR public.is_interviewer() OR public.is_admin());

-- fee_agreements policies
DROP POLICY IF EXISTS "Admins have full access to fee_agreements" ON public.fee_agreements;
CREATE POLICY "Admins have full access to fee_agreements"
  ON public.fee_agreements FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers and Interviewers have select access to fee_agreements" ON public.fee_agreements;
CREATE POLICY "Teachers and Interviewers have select access to fee_agreements"
  ON public.fee_agreements FOR SELECT TO authenticated
  USING (public.is_teacher() OR public.is_interviewer() OR public.is_admin());

-- payment_status_tracking policies
DROP POLICY IF EXISTS "Admins have full access to payment_status_tracking" ON public.payment_status_tracking;
CREATE POLICY "Admins have full access to payment_status_tracking"
  ON public.payment_status_tracking FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers and Interviewers have select access to payment_status_tracking" ON public.payment_status_tracking;
CREATE POLICY "Teachers and Interviewers have select access to payment_status_tracking"
  ON public.payment_status_tracking FOR SELECT TO authenticated
  USING (public.is_teacher() OR public.is_interviewer() OR public.is_admin());


-- =============================================================================
-- HASHIR KHAN ATTENDANCE APP — STUDENT ADMISSION & PROGRESS WORKFLOW MIGRATION (015)
-- Paste in Supabase Dashboard → SQL Editor → Run
-- =============================================================================

-- 1. ALTER student_profiles
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.student_profiles'::regclass AND contype = 'c' AND conname LIKE '%level%';
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.student_profiles DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

ALTER TABLE public.student_profiles ADD CONSTRAINT student_profiles_level_check 
  CHECK (level IN ('Beginner', 'Elementary', 'Intermediate', 'Advanced'));

ALTER TABLE public.student_profiles ADD COLUMN IF NOT EXISTS class text;
ALTER TABLE public.student_profiles ADD COLUMN IF NOT EXISTS section text;

-- 2. CREATE student_interviews TABLE
CREATE TABLE IF NOT EXISTS public.student_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interview_type text CHECK (interview_type IN ('admission', 'fortnight_1', 'fortnight_2', 'fortnight_3', 'fortnight_ongoing')) NOT NULL,
  interviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  level text CHECK (level IN ('Beginner', 'Elementary', 'Intermediate', 'Advanced')),
  english_level text,
  subject_knowledge text,
  learning_ability text,
  notes text,
  recommendations text,
  recommended_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  recommended_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recommended_class text,
  created_at timestamptz DEFAULT now()
);

-- 3. CREATE interview_assessments TABLE
CREATE TABLE IF NOT EXISTS public.interview_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.student_interviews(id) ON DELETE CASCADE,
  speaking_score numeric DEFAULT 0 CHECK (speaking_score >= 0 AND speaking_score <= 10),
  reading_score numeric DEFAULT 0 CHECK (reading_score >= 0 AND reading_score <= 10),
  writing_score numeric DEFAULT 0 CHECK (writing_score >= 0 AND writing_score <= 10),
  listening_score numeric DEFAULT 0 CHECK (listening_score >= 0 AND listening_score <= 10),
  attendance_score numeric DEFAULT 0 CHECK (attendance_score >= 0 AND attendance_score <= 10),
  remarks text
);

-- 4. CREATE student_progress_reports TABLE
CREATE TABLE IF NOT EXISTS public.student_progress_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  progress_notes text,
  improvement_percentage numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 5. CREATE teacher_student_notifications TABLE
CREATE TABLE IF NOT EXISTS public.teacher_student_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 6. CREATE fee_ledger TABLE
CREATE TABLE IF NOT EXISTS public.fee_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_fee numeric NOT NULL CHECK (total_fee >= 0),
  paid_amount numeric NOT NULL CHECK (paid_amount >= 0),
  remaining_balance numeric NOT NULL,
  remarks text,
  collected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_date timestamptz DEFAULT now()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.student_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_student_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_ledger ENABLE ROW LEVEL SECURITY;

-- 7. DEFINE RLS POLICIES

-- student_interviews Policies
DROP POLICY IF EXISTS "Select student_interviews" ON public.student_interviews;
CREATE POLICY "Select student_interviews" ON public.student_interviews
  FOR SELECT TO authenticated USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_director()
    OR public.is_interviewer()
    OR public.is_teacher()
  );

DROP POLICY IF EXISTS "Interviewer manage student_interviews" ON public.student_interviews;
CREATE POLICY "Interviewer manage student_interviews" ON public.student_interviews
  FOR ALL TO authenticated USING (
    public.is_admin() OR public.is_interviewer()
  );

-- interview_assessments Policies
DROP POLICY IF EXISTS "Select interview_assessments" ON public.interview_assessments;
CREATE POLICY "Select interview_assessments" ON public.interview_assessments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.student_interviews si
      WHERE si.id = interview_assessments.interview_id
        AND (si.student_id = auth.uid() OR public.is_admin() OR public.is_director() OR public.is_interviewer() OR public.is_teacher())
    )
  );

DROP POLICY IF EXISTS "Interviewer manage interview_assessments" ON public.interview_assessments;
CREATE POLICY "Interviewer manage interview_assessments" ON public.interview_assessments
  FOR ALL TO authenticated USING (
    public.is_admin() OR public.is_interviewer()
  );

-- student_progress_reports Policies
DROP POLICY IF EXISTS "Select student_progress_reports" ON public.student_progress_reports;
CREATE POLICY "Select student_progress_reports" ON public.student_progress_reports
  FOR SELECT TO authenticated USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_director()
    OR public.is_teacher()
    OR public.is_interviewer()
  );

DROP POLICY IF EXISTS "Teacher manage progress_reports" ON public.student_progress_reports;
CREATE POLICY "Teacher manage progress_reports" ON public.student_progress_reports
  FOR ALL TO authenticated USING (
    public.is_admin() OR public.is_teacher()
  );

-- teacher_student_notifications Policies
DROP POLICY IF EXISTS "Select teacher_student_notifications" ON public.teacher_student_notifications;
CREATE POLICY "Select teacher_student_notifications" ON public.teacher_student_notifications
  FOR SELECT TO authenticated USING (
    teacher_id = auth.uid()
    OR student_id = auth.uid()
    OR public.is_admin()
    OR public.is_director()
  );

DROP POLICY IF EXISTS "Manage teacher_student_notifications" ON public.teacher_student_notifications;
CREATE POLICY "Manage teacher_student_notifications" ON public.teacher_student_notifications
  FOR ALL TO authenticated USING (
    public.is_admin() OR public.is_teacher()
  );

-- fee_ledger Policies
DROP POLICY IF EXISTS "Select fee_ledger" ON public.fee_ledger;
CREATE POLICY "Select fee_ledger" ON public.fee_ledger
  FOR SELECT TO authenticated USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_director()
  );

DROP POLICY IF EXISTS "Manage fee_ledger" ON public.fee_ledger;
CREATE POLICY "Manage fee_ledger" ON public.fee_ledger
  FOR ALL TO authenticated USING (
    public.is_admin() OR public.is_director()
  );

-- =============================================================================
-- HASHIR KHAN ATTENDANCE APP — STUDENT ADMISSION WORKFLOW MIGRATION (016)
-- =============================================================================

-- 1. Alter admissions/admission_deals table
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS student_email text;
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS student_account_status text CHECK (student_account_status IN ('pending', 'waiting_approval', 'approved', 'rejected')) DEFAULT 'pending';
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS father_name text;
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS whatsapp_number text;
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS class text;
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Alter profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_id uuid;

-- 3. Alter student_profiles table
ALTER TABLE public.student_profiles ADD COLUMN IF NOT EXISTS email text;
-- Add unique constraint on email if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_profiles_email_key'
  ) THEN
    ALTER TABLE public.student_profiles ADD CONSTRAINT student_profiles_email_key UNIQUE (email);
  END IF;
END $$;

-- 4. Create function to securely create a student user record from the admission process
CREATE OR REPLACE FUNCTION public.create_student_from_admission(
  p_email text,
  p_name text,
  p_father_name text,
  p_phone text,
  p_whatsapp text,
  p_course_id uuid,
  p_class text,
  p_teacher_id uuid,
  p_deal_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_temp_pw_hash text;
BEGIN
  -- Check if user already exists in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  -- If user does not exist, create them in auth.users
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_temp_pw_hash := crypt(gen_random_uuid()::text, gen_salt('bf'));
    
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      p_email,
      v_temp_pw_hash,
      now(), -- confirm email by default so they can reset password/login after password set
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('name', p_name, 'role', 'student'),
      false,
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
  END IF;

  -- Ensure profile exists (handle_new_user trigger might have done this, but let's be sure or update it)
  INSERT INTO public.profiles (id, email, name, role, approved, status)
  VALUES (v_user_id, p_email, p_name, 'student', false, 'pending')
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, name = EXCLUDED.name, role = 'student';

  -- Ensure student_profile exists
  INSERT INTO public.student_profiles (id, email, assigned_teacher_id, class, created_at, updated_at)
  VALUES (v_user_id, p_email, p_teacher_id, p_class, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, assigned_teacher_id = EXCLUDED.assigned_teacher_id, class = EXCLUDED.class;

  -- Link the student profile back to profiles table
  UPDATE public.profiles SET student_id = v_user_id WHERE id = v_user_id;

  -- Link the admission deal to the student
  UPDATE public.admission_deals
  SET student_id = v_user_id,
      student_account_status = 'pending'
  WHERE id = p_deal_id;

  RETURN v_user_id;
END;
$$;

-- 5. Create function to set password during onboarding (claiming account)
CREATE OR REPLACE FUNCTION public.activate_student_auth(
  p_email text,
  p_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_pw_hash text;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No pending account found for email: %', p_email;
  END IF;

  -- Check if profile is already approved or is pending activation
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = v_user_id AND status = 'approved' AND approved = true
  ) THEN
    RAISE EXCEPTION 'Account is already active. Please log in.';
  END IF;

  -- Hash new password
  v_pw_hash := crypt(p_password, gen_salt('bf'));

  -- Update user password in auth.users
  UPDATE auth.users
  SET encrypted_password = v_pw_hash,
      updated_at = now()
  WHERE id = v_user_id;

  -- Set status in profiles to waiting_approval
  UPDATE public.profiles
  SET status = 'waiting_approval',
      approved = false
  WHERE id = v_user_id;

  -- Set status in admission_deals to waiting_approval
  UPDATE public.admission_deals
  SET student_account_status = 'waiting_approval'
  WHERE student_email = p_email;

  -- Generate a system notification alert for admin
  INSERT INTO public.notifications (
    user_id,
    role,
    notification_type,
    title,
    message,
    read
  )
  SELECT 
    p.id,
    'admin',
    'progress_review_due', -- reusing notification types
    'Pending Approval Action Required',
    'Student ' || p_email || ' has set their password and is waiting for your approval.',
    false
  FROM public.profiles p
  WHERE p.role = 'admin' AND p.approved = true;

  RETURN true;
END;
$$;

-- 6. Create function to approve student admission & handle cascade setup
CREATE OR REPLACE FUNCTION public.approve_student_admission(
  p_student_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email text;
  v_course_id uuid;
  v_class text;
  v_teacher_id uuid;
  v_deal_id uuid;
  v_name text;
BEGIN
  -- Get user email and name
  SELECT email, name INTO v_email, v_name FROM public.profiles WHERE id = p_student_id;

  -- Get deal info
  SELECT id, course_id, class, teacher_id 
  INTO v_deal_id, v_course_id, v_class, v_teacher_id
  FROM public.admission_deals
  WHERE student_email = v_email OR student_id = p_student_id
  LIMIT 1;

  -- Approve student in profiles
  UPDATE public.profiles
  SET approved = true,
      status = 'approved'
  WHERE id = p_student_id;

  -- Update student profile fields
  IF v_class IS NOT NULL OR v_teacher_id IS NOT NULL THEN
    UPDATE public.student_profiles
    SET class = COALESCE(class, v_class),
        assigned_teacher_id = COALESCE(assigned_teacher_id, v_teacher_id),
        updated_at = now()
    WHERE id = p_student_id;
  END IF;

  -- Auto-enroll student in the course
  IF v_course_id IS NOT NULL THEN
    INSERT INTO public.course_students (course_id, student_id)
    VALUES (v_course_id, p_student_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Update admission deal status
  UPDATE public.admission_deals
  SET student_account_status = 'approved',
      student_id = p_student_id
  WHERE student_email = v_email OR student_id = p_student_id;

  -- Create fee ledger record automatically (initial entry)
  IF EXISTS (SELECT 1 FROM public.admission_deals WHERE student_email = v_email) THEN
    DECLARE
      v_final_fee numeric;
      v_is_paid boolean;
    BEGIN
      SELECT final_fee, (payment_status = 'paid') INTO v_final_fee, v_is_paid
      FROM public.admission_deals
      WHERE student_email = v_email OR student_id = p_student_id
      LIMIT 1;

      INSERT INTO public.fee_ledger (student_id, total_fee, paid_amount, remaining_balance, remarks, payment_date)
      VALUES (
        p_student_id,
        v_final_fee,
        CASE WHEN v_is_paid THEN v_final_fee ELSE 0 END,
        CASE WHEN v_is_paid THEN 0 ELSE v_final_fee END,
        'Auto-generated from approved admission agreement',
        now()
      )
      ON CONFLICT DO NOTHING;

      -- If not paid, also generate a fee payment record in fee_payments
      IF NOT v_is_paid THEN
        INSERT INTO public.fee_payments (student_id, amount, due_date, status)
        VALUES (p_student_id, v_final_fee, (CURRENT_DATE + INTERVAL '10 days')::date, 'unpaid')
        ON CONFLICT DO NOTHING;
      END IF;
    END;
  END IF;

  -- Send welcome notifications to the student
  INSERT INTO public.notifications (user_id, role, notification_type, title, message, read)
  VALUES (
    p_student_id,
    'student',
    'payment_approved',
    'Account Approved!',
    'Your student account has been approved. Welcome to the institution! You now have full access to your student dashboard.',
    false
  );

  -- Send notification to the teacher if assigned
  IF v_teacher_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, role, notification_type, title, message, read)
    VALUES (
      v_teacher_id,
      'teacher',
      'interview_completed',
      'New Student Assigned',
      'A new student, ' || v_name || ', has been admitted and assigned to your class: ' || COALESCE(v_class, 'N/A') || '.',
      false
    );
  END IF;

  RETURN true;
END;
$$;

-- 7. RLS Policies Updates: ensure student can view their own admission deal and other data
DROP POLICY IF EXISTS "Students read own admission deals" ON public.admission_deals;
CREATE POLICY "Students read own admission deals" ON public.admission_deals
  FOR SELECT TO authenticated
  USING (student_email = auth.email() OR student_id = auth.uid());



