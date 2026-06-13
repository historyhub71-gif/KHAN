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
