-- =============================================================================
-- MASTER SETUP SQL — HASHIR KHAN ATTENDANCE APP
-- Complete business rules per GEMINI.md
-- Safe to re-run: uses IF NOT EXISTS, CREATE OR REPLACE, DO$$ blocks
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CORE TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id                     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                   text,
  email                  text UNIQUE,
  role                   text,
  approved               boolean DEFAULT false,
  status                 text DEFAULT 'pending',
  student_id             uuid,
  official_check_in_time text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- Ensure official_check_in_time is added to existing profiles tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS official_check_in_time text;

-- Drop & re-apply role + status constraints to keep them current
DO $$ BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin','teacher','student','interviewer','director'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('pending','approved','rejected','waiting_approval'));

-- COURSES
CREATE TABLE IF NOT EXISTS public.courses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text,
  code       text UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- COURSE_STUDENTS
CREATE TABLE IF NOT EXISTS public.course_students (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (course_id, student_id)
);

-- COURSE_TEACHERS
CREATE TABLE IF NOT EXISTS public.course_teachers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (course_id, teacher_id)
);

-- ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     text CHECK (status IN ('present','absent')),
  date       date,
  created_at timestamptz DEFAULT now()
);

-- Attendance unique constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_course_student_date_unique'
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_course_student_date_unique UNIQUE (course_id, student_id, date);
  END IF;
END $$;

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id         uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  attendance_id     uuid REFERENCES public.attendance(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role              text,
  notification_type text,
  title             text NOT NULL DEFAULT 'Notification',
  message           text NOT NULL,
  read              boolean NOT NULL DEFAULT false,
  status            text CHECK (status IN ('read','unread')) DEFAULT 'unread',
  sent_at           timestamptz DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Drop old notification_type check (both possible constraint names) and re-add expanded version
DO $$ BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
EXCEPTION WHEN others THEN NULL; END $$;

-- Also drop the double-prefixed variant that exists in some live deployments
DO $$ BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notifications_type_check;
EXCEPTION WHEN others THEN NULL; END $$;

-- Normalize old/invalid notification_type values before adding the check constraint.
-- Without this, existing rows from older setup scripts can block the master setup.
UPDATE public.notifications
SET notification_type = CASE
  WHEN notification_type IS NULL OR btrim(notification_type) = '' THEN 'Attendance Alert'
  WHEN lower(btrim(notification_type)) IN ('attendance alert','attendance_alert','absence','absent','absence_alert','absent_alert') THEN 'Attendance Alert'
  WHEN lower(btrim(notification_type)) IN ('monthly fee due reminder','monthly_fee_due_reminder','fee_due','fee_due_reminder') THEN 'Monthly Fee Due Reminder'
  WHEN lower(btrim(notification_type)) IN ('fee overdue reminder','fee_overdue_reminder','overdue_fee','overdue') THEN 'Fee Overdue Reminder'
  WHEN lower(btrim(notification_type)) IN ('payment received confirmation','payment_received_confirmation','payment_received') THEN 'Payment Received Confirmation'
  WHEN lower(btrim(notification_type)) IN ('fee approval/rejection notification','fee_approval_rejection_notification','payment_rejected','fee_rejected') THEN 'Fee Approval/Rejection Notification'
  WHEN lower(btrim(notification_type)) = 'interview completed' THEN 'interview_completed'
  WHEN lower(btrim(notification_type)) = 'progress review due' THEN 'progress_review_due'
  WHEN lower(btrim(notification_type)) = 'payment approved' THEN 'payment_approved'
  WHEN lower(btrim(notification_type)) = 'interview pending review' THEN 'interview_pending_review'
  WHEN lower(btrim(notification_type)) = 'admission decision' THEN 'admission_decision'
  WHEN lower(btrim(notification_type)) = 'interview reviewed' THEN 'interview_reviewed'
  WHEN lower(btrim(notification_type)) = 'review scheduled' THEN 'review_scheduled'
  WHEN lower(btrim(notification_type)) = 'fortnight review due' THEN 'fortnight_review_due'
  WHEN lower(btrim(notification_type)) = 'fee ledger updated' THEN 'fee_ledger_updated'
  WHEN lower(btrim(notification_type)) = 'admission approved' THEN 'admission_approved'
  WHEN lower(btrim(notification_type)) = 'new student assigned' THEN 'new_student_assigned'
  WHEN lower(btrim(notification_type)) = 'progress report' THEN 'progress_report'
  WHEN lower(btrim(notification_type)) = 'new student interview required' THEN 'New Student Interview Required'
  ELSE notification_type
END
WHERE notification_type IS NULL
   OR btrim(notification_type) = ''
   OR notification_type NOT IN (
    'Monthly Fee Due Reminder','Fee Overdue Reminder','Payment Received Confirmation',
    'Fee Approval/Rejection Notification','Attendance Alert',
    'interview_completed','progress_review_due','payment_approved','payment_rejected',
    'interview_pending_review','admission_decision','interview_reviewed',
    'review_scheduled','fortnight_review_due','fee_ledger_updated',
    'admission_approved','new_student_assigned','progress_report','New Student Interview Required'
  );

UPDATE public.notifications
SET notification_type = 'Attendance Alert'
WHERE notification_type NOT IN (
  'Monthly Fee Due Reminder','Fee Overdue Reminder','Payment Received Confirmation',
  'Fee Approval/Rejection Notification','Attendance Alert',
  'interview_completed','progress_review_due','payment_approved','payment_rejected',
  'interview_pending_review','admission_decision','interview_reviewed',
  'review_scheduled','fortnight_review_due','fee_ledger_updated',
  'admission_approved','new_student_assigned','progress_report','New Student Interview Required'
);

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN (
    'Monthly Fee Due Reminder','Fee Overdue Reminder','Payment Received Confirmation',
    'Fee Approval/Rejection Notification','Attendance Alert',
    'interview_completed','progress_review_due','payment_approved','payment_rejected',
    'interview_pending_review','admission_decision','interview_reviewed',
    'review_scheduled','fortnight_review_due','fee_ledger_updated',
    'admission_approved','new_student_assigned','progress_report','New Student Interview Required'
  ));

-- Unique index for notifications per attendance record
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_attendance_unique
  ON public.notifications (attendance_id) WHERE attendance_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PROFILE EXTENSION TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- STUDENT_PROFILES
CREATE TABLE IF NOT EXISTS public.student_profiles (
  id                  uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email               text,
  level               text,
  class               text,
  section             text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.student_profiles DROP CONSTRAINT IF EXISTS student_profiles_level_check;
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE public.student_profiles
  ADD CONSTRAINT student_profiles_level_check
  CHECK (level IN ('Beginner','Elementary','Intermediate','Advanced'));

-- Named FK for the assigned_teacher_id to disambiguate PostgREST joins
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assigned_teacher') THEN
    ALTER TABLE public.student_profiles
      ADD CONSTRAINT fk_assigned_teacher
      FOREIGN KEY (assigned_teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

-- TEACHER_PROFILES
CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  id         uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- INTERVIEWER_PROFILES
CREATE TABLE IF NOT EXISTS public.interviewer_profiles (
  id         uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. INTERVIEWS (Unified: admission + progress_review)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interviews (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interviewer_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  interview_type        text CHECK (interview_type IN ('admission','progress_review')) NOT NULL,
  status                text DEFAULT 'pending_admin_review'
                        CHECK (status IN ('draft','completed','pending_admin_review','admin_approved','admin_rejected')),
  notes                 text,
  english               numeric CHECK (english >= 0 AND english <= 10),
  communication         numeric CHECK (communication >= 0 AND communication <= 10),
  confidence            numeric CHECK (confidence >= 0 AND confidence <= 10),
  technical_skills      numeric CHECK (technical_skills >= 0 AND technical_skills <= 10),
  learning_ability      numeric CHECK (learning_ability >= 0 AND learning_ability <= 10),
  total_score           numeric DEFAULT 0,
  assigned_level        text CHECK (assigned_level IN ('Beginner','Elementary','Intermediate','Advanced')),
  strengths             text,
  weaknesses            text,
  recommendations       text,
  recommended_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  recommended_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_reviewed_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_reviewed_at     timestamptz,
  admin_notes           text,
  student_email         text,
  student_name          text,
  deleted_at            timestamptz,
  deleted_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Drop and re-add interviews_assigned_level_check constraint to include 'Elementary'
DO $$ BEGIN
  ALTER TABLE public.interviews DROP CONSTRAINT IF EXISTS interviews_assigned_level_check;
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_assigned_level_check
  CHECK (assigned_level IN ('Beginner','Elementary','Intermediate','Advanced'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ADMISSION DEALS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admission_deals (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name           text NOT NULL,
  student_email          text NOT NULL,
  student_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  father_name            text,
  phone_number           text,
  whatsapp_number        text,
  course_id              uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  teacher_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  class                  text,
  original_fee           numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount        numeric(10,2) NOT NULL DEFAULT 0,
  discount_percentage    numeric(5,2)  NOT NULL DEFAULT 0,
  final_fee              numeric(10,2) NOT NULL DEFAULT 0,
  payment_status         text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid')),
  remarks                text DEFAULT '',
  admission_status       text NOT NULL DEFAULT 'pending'
                         CHECK (admission_status IN ('pending','pending_admin_review','approved','rejected')),
  student_account_status text DEFAULT 'pending'
                         CHECK (student_account_status IN ('pending','waiting_approval','approved_for_signup','account_created','approved','rejected')),
  interview_id           uuid REFERENCES public.interviews(id) ON DELETE SET NULL,
  created_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ADMISSION DISCOUNTS LOG
CREATE TABLE IF NOT EXISTS public.admission_discounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             uuid REFERENCES public.admission_deals(id) ON DELETE CASCADE,
  discount_amount     numeric NOT NULL CHECK (discount_amount >= 0),
  discount_percentage numeric NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  remarks             text,
  created_at          timestamptz DEFAULT now()
);

-- FEE AGREEMENTS LOG
CREATE TABLE IF NOT EXISTS public.fee_agreements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id        uuid REFERENCES public.admission_deals(id) ON DELETE CASCADE,
  agreed_amount  numeric NOT NULL CHECK (agreed_amount >= 0),
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- PAYMENT STATUS TRACKING
CREATE TABLE IF NOT EXISTS public.payment_status_tracking (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    uuid REFERENCES public.admission_deals(id) ON DELETE CASCADE,
  status     text NOT NULL CHECK (status IN ('pending','paid')),
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. FEE MANAGEMENT
-- ─────────────────────────────────────────────────────────────────────────────

-- FEE_PAYMENTS
CREATE TABLE IF NOT EXISTS public.fee_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount           numeric NOT NULL CHECK (amount >= 0),
  due_date         date NOT NULL,
  status           text CHECK (status IN ('unpaid','pending','approved','rejected')) DEFAULT 'unpaid',
  payment_method   text CHECK (payment_method IN ('Cash','Card','Bank Transfer','Mobile Wallet','None')) DEFAULT 'None',
  payment_date     timestamptz,
  notes            text,
  submitted_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason text,
  balance_before   numeric DEFAULT 0,
  balance_after    numeric DEFAULT 0,
  deleted_at       timestamptz,
  deleted_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Unique index: one payment per student per due_date
CREATE UNIQUE INDEX IF NOT EXISTS unique_student_id_due_date
  ON public.fee_payments (student_id, due_date);

-- FEE_RECEIPTS
CREATE TABLE IF NOT EXISTS public.fee_receipts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id     uuid NOT NULL UNIQUE REFERENCES public.fee_payments(id) ON DELETE CASCADE,
  receipt_number text UNIQUE NOT NULL DEFAULT 'RCPT-TEMP',
  deleted_at     timestamptz,
  deleted_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now()
);

-- FEE_LEDGER
CREATE TABLE IF NOT EXISTS public.fee_ledger (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_fee         numeric(10,2) NOT NULL DEFAULT 0,
  paid_amount       numeric(10,2) NOT NULL DEFAULT 0,
  remaining_balance numeric(10,2) NOT NULL DEFAULT 0,
  remarks           text,
  collected_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_date      date NOT NULL DEFAULT CURRENT_DATE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TEACHER MANAGEMENT
-- ─────────────────────────────────────────────────────────────────────────────

-- TEACHER_ATTENDANCE
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date       date NOT NULL DEFAULT CURRENT_DATE,
  check_in   time,
  check_out  time,
  status     text CHECK (status IN ('present','absent','late')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (teacher_id, date)
);

-- TEACHER_SALARY_SETTINGS
CREATE TABLE IF NOT EXISTS public.teacher_salary_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  monthly_salary numeric NOT NULL CHECK (monthly_salary >= 0),
  working_days   integer NOT NULL CHECK (working_days > 0),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz DEFAULT now()
);

-- SALARY_DEDUCTIONS
CREATE TABLE IF NOT EXISTS public.salary_deductions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month              integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year               integer NOT NULL,
  base_salary        numeric NOT NULL,
  working_days       integer NOT NULL,
  actual_absences    integer NOT NULL DEFAULT 0,
  total_lates        integer NOT NULL DEFAULT 0,
  effective_absences numeric NOT NULL DEFAULT 0,
  deduction_amount   numeric NOT NULL DEFAULT 0,
  final_salary       numeric NOT NULL,
  created_at         timestamptz DEFAULT now(),
  UNIQUE (teacher_id, month, year)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ENROLLMENT & REVIEW SCHEDULING
-- ─────────────────────────────────────────────────────────────────────────────

-- STUDENT_ENROLLMENTS
CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id         uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admission_deal_id uuid REFERENCES public.admission_deals(id) ON DELETE SET NULL,
  enrolled_at       timestamptz NOT NULL DEFAULT now(),
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','completed')),
  UNIQUE (student_id, course_id)
);

-- FORTNIGHT_REVIEWS (Unified review schedule - replaces student_progress_reviews)
CREATE TABLE IF NOT EXISTS public.fortnight_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  review_number  int NOT NULL DEFAULT 1,
  scheduled_date date NOT NULL,
  completed_at   timestamptz,
  interview_id   uuid REFERENCES public.interviews(id) ON DELETE SET NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. AUDIT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id  uuid NOT NULL,
  action     text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz DEFAULT now()
);

-- STUDENT_PROGRESS_REPORTS (Teacher-authored)
CREATE TABLE IF NOT EXISTS public.student_progress_reports (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  progress_notes         text,
  improvement_percentage numeric(5,2) DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_course_date ON public.attendance (course_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_student_read ON public.notifications (student_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications (user_id, status);
CREATE INDEX IF NOT EXISTS idx_student_profiles_teacher ON public.student_profiles (assigned_teacher_id);
CREATE INDEX IF NOT EXISTS idx_interviews_student ON public.interviews (student_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON public.fee_payments (student_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fee_payments_due ON public.fee_payments (due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date ON public.teacher_attendance (teacher_id, date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. ENABLE ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_salary_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_status_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fortnight_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress_reports ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. ROLE HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND approved = true);
$$;

DROP FUNCTION IF EXISTS public.is_teacher() CASCADE;
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher' AND approved = true);
$$;

DROP FUNCTION IF EXISTS public.is_student() CASCADE;
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND approved = true);
$$;

DROP FUNCTION IF EXISTS public.is_interviewer() CASCADE;
CREATE OR REPLACE FUNCTION public.is_interviewer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'interviewer' AND approved = true);
$$;

DROP FUNCTION IF EXISTS public.is_director() CASCADE;
CREATE OR REPLACE FUNCTION public.is_director()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'director' AND approved = true);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- ── PROFILES ──
DROP POLICY IF EXISTS "Users can read own profile or admin/teacher" ON public.profiles;
CREATE POLICY "Users can read own profile or admin/teacher" ON public.profiles
  FOR SELECT TO authenticated USING (
    id = auth.uid() OR is_admin() OR is_teacher() OR is_director() OR is_interviewer()
  );

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Only admin can update profiles" ON public.profiles;
CREATE POLICY "Only admin can update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Only admin can delete profiles" ON public.profiles;
CREATE POLICY "Only admin can delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (is_admin());

-- ── COURSES ──
DROP POLICY IF EXISTS "Users can view courses" ON public.courses;
CREATE POLICY "Users can view courses" ON public.courses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true));

DROP POLICY IF EXISTS "Only admin can insert courses" ON public.courses;
CREATE POLICY "Only admin can insert courses" ON public.courses FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Only admin can update courses" ON public.courses;
CREATE POLICY "Only admin can update courses" ON public.courses FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Only admin can delete courses" ON public.courses;
CREATE POLICY "Only admin can delete courses" ON public.courses FOR DELETE TO authenticated USING (is_admin());

-- ── COURSE_STUDENTS ──
DROP POLICY IF EXISTS "Users can view course_students" ON public.course_students;
CREATE POLICY "Users can view course_students" ON public.course_students FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true));

DROP POLICY IF EXISTS "Only admin can insert course_students" ON public.course_students;
CREATE POLICY "Only admin can insert course_students" ON public.course_students FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Only admin can update course_students" ON public.course_students;
CREATE POLICY "Only admin can update course_students" ON public.course_students FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Only admin can delete course_students" ON public.course_students;
CREATE POLICY "Only admin can delete course_students" ON public.course_students FOR DELETE TO authenticated USING (is_admin());

-- ── COURSE_TEACHERS ──
DROP POLICY IF EXISTS "Users can view course_teachers" ON public.course_teachers;
CREATE POLICY "Users can view course_teachers" ON public.course_teachers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true));

DROP POLICY IF EXISTS "Only admin can insert course_teachers" ON public.course_teachers;
CREATE POLICY "Only admin can insert course_teachers" ON public.course_teachers FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Only admin can update course_teachers" ON public.course_teachers;
CREATE POLICY "Only admin can update course_teachers" ON public.course_teachers FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Only admin can delete course_teachers" ON public.course_teachers;
CREATE POLICY "Only admin can delete course_teachers" ON public.course_teachers FOR DELETE TO authenticated USING (is_admin());

-- ── ATTENDANCE ──
DROP POLICY IF EXISTS "Students view own attendance" ON public.attendance;
CREATE POLICY "Students view own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (is_student() AND student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers view course attendance" ON public.attendance;
CREATE POLICY "Teachers view course attendance" ON public.attendance FOR SELECT TO authenticated
  USING (is_teacher() AND EXISTS (SELECT 1 FROM public.course_teachers ct WHERE ct.course_id = attendance.course_id AND ct.teacher_id = auth.uid()));

DROP POLICY IF EXISTS "Admins view all attendance" ON public.attendance;
CREATE POLICY "Admins view all attendance" ON public.attendance FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Only teacher can insert attendance" ON public.attendance;
CREATE POLICY "Only teacher can insert attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true AND role = 'teacher'));

DROP POLICY IF EXISTS "Only teacher can update attendance" ON public.attendance;
CREATE POLICY "Only teacher can update attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true AND role = 'teacher'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true AND role = 'teacher'));

DROP POLICY IF EXISTS "Only teacher can delete attendance" ON public.attendance;
CREATE POLICY "Only teacher can delete attendance" ON public.attendance FOR DELETE TO authenticated
  USING (is_teacher() OR is_admin());

-- ── NOTIFICATIONS ──
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.notifications;
CREATE POLICY "Enable read for authenticated users" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR student_id = auth.uid() OR is_admin() OR is_interviewer());

DROP POLICY IF EXISTS "Students update own notifications" ON public.notifications;
CREATE POLICY "Students update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR student_id = auth.uid()) WITH CHECK (user_id = auth.uid() OR student_id = auth.uid());

DROP POLICY IF EXISTS "Students delete own notifications" ON public.notifications;
CREATE POLICY "Students delete own notifications" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR student_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── STUDENT_PROFILES ──
DROP POLICY IF EXISTS "Students view own profile details" ON public.student_profiles;
CREATE POLICY "Students view own profile details" ON public.student_profiles FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Teachers and Interviewers view student details" ON public.student_profiles;
CREATE POLICY "Teachers and Interviewers view student details" ON public.student_profiles
  FOR SELECT TO authenticated USING (is_teacher() OR is_interviewer() OR is_admin());

DROP POLICY IF EXISTS "Admin manage student details" ON public.student_profiles;
CREATE POLICY "Admin manage student details" ON public.student_profiles FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Interviewers manage student profiles" ON public.student_profiles;
CREATE POLICY "Interviewers manage student profiles" ON public.student_profiles
  FOR ALL TO authenticated USING (is_interviewer()) WITH CHECK (is_interviewer());

-- ── TEACHER_PROFILES / INTERVIEWER_PROFILES ──
DROP POLICY IF EXISTS "Teachers read own profiles" ON public.teacher_profiles;
CREATE POLICY "Teachers read own profiles" ON public.teacher_profiles FOR SELECT TO authenticated USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Admin manage teacher profiles" ON public.teacher_profiles;
CREATE POLICY "Admin manage teacher profiles" ON public.teacher_profiles FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Interviewers read own profiles" ON public.interviewer_profiles;
CREATE POLICY "Interviewers read own profiles" ON public.interviewer_profiles FOR SELECT TO authenticated USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Admin manage interviewer profiles" ON public.interviewer_profiles;
CREATE POLICY "Admin manage interviewer profiles" ON public.interviewer_profiles FOR ALL TO authenticated USING (is_admin());

-- ── INTERVIEWS ──
DROP POLICY IF EXISTS "Students read own interviews" ON public.interviews;
CREATE POLICY "Students read own interviews" ON public.interviews FOR SELECT TO authenticated
  USING (student_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Teachers read interviews of assigned students" ON public.interviews;
CREATE POLICY "Teachers read interviews of assigned students" ON public.interviews FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_profiles sp WHERE sp.id = interviews.student_id AND sp.assigned_teacher_id = auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "ASR manage placement interviews" ON public.interviews;
CREATE POLICY "ASR manage placement interviews" ON public.interviews
  FOR ALL TO authenticated USING (is_interviewer() OR is_admin());

DROP POLICY IF EXISTS "Admin manage all interviews" ON public.interviews;
CREATE POLICY "Admin manage all interviews" ON public.interviews FOR ALL TO authenticated USING (is_admin());

-- ── FEE_PAYMENTS ──
DROP POLICY IF EXISTS "Students read own fee payments" ON public.fee_payments;
CREATE POLICY "Students read own fee payments" ON public.fee_payments FOR SELECT TO authenticated
  USING (student_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Director manage all fee payments" ON public.fee_payments;
CREATE POLICY "Director manage all fee payments" ON public.fee_payments FOR ALL TO authenticated
  USING (is_director() OR is_admin());

DROP POLICY IF EXISTS "Admin manage all fee payments" ON public.fee_payments;
CREATE POLICY "Admin manage all fee payments" ON public.fee_payments FOR ALL TO authenticated USING (is_admin());

-- ── FEE_RECEIPTS ──
DROP POLICY IF EXISTS "Students read own receipts" ON public.fee_receipts;
CREATE POLICY "Students read own receipts" ON public.fee_receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fee_payments fp WHERE fp.id = fee_receipts.payment_id AND fp.student_id = auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Director manage all receipts" ON public.fee_receipts;
CREATE POLICY "Director manage all receipts" ON public.fee_receipts FOR ALL TO authenticated USING (is_director() OR is_admin());

-- ── FEE_LEDGER ──
DROP POLICY IF EXISTS "Select fee_ledger" ON public.fee_ledger;
CREATE POLICY "Select fee_ledger" ON public.fee_ledger FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR is_admin() OR is_director());

DROP POLICY IF EXISTS "Manage fee_ledger" ON public.fee_ledger;
CREATE POLICY "Manage fee_ledger" ON public.fee_ledger FOR ALL TO authenticated
  USING (is_admin() OR is_director());

-- ── TEACHER_ATTENDANCE ──
DROP POLICY IF EXISTS "Teachers log own attendance" ON public.teacher_attendance;
CREATE POLICY "Teachers log own attendance" ON public.teacher_attendance FOR ALL TO authenticated USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Admin manage teacher attendance" ON public.teacher_attendance;
CREATE POLICY "Admin manage teacher attendance" ON public.teacher_attendance FOR ALL TO authenticated USING (is_admin());

-- ── TEACHER_SALARY_SETTINGS ──
DROP POLICY IF EXISTS "Admin manage salary settings" ON public.teacher_salary_settings;
CREATE POLICY "Admin manage salary settings" ON public.teacher_salary_settings FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Teachers read own salary settings" ON public.teacher_salary_settings;
CREATE POLICY "Teachers read own salary settings" ON public.teacher_salary_settings FOR SELECT TO authenticated USING (teacher_id = auth.uid() OR is_admin());

-- ── SALARY_DEDUCTIONS ──
DROP POLICY IF EXISTS "Admin manage salary deductions" ON public.salary_deductions;
CREATE POLICY "Admin manage salary deductions" ON public.salary_deductions FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Teachers read own deductions" ON public.salary_deductions;
CREATE POLICY "Teachers read own deductions" ON public.salary_deductions FOR SELECT TO authenticated USING (teacher_id = auth.uid() OR is_admin());

-- ── ADMISSION_DEALS ──
DROP POLICY IF EXISTS "Admins can manage admission_deals" ON public.admission_deals;
CREATE POLICY "Admins can manage admission_deals" ON public.admission_deals FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Interviewers can view and update admission_deals" ON public.admission_deals;
CREATE POLICY "Interviewers can view and update admission_deals" ON public.admission_deals FOR ALL TO authenticated USING (is_interviewer()) WITH CHECK (is_interviewer());

DROP POLICY IF EXISTS "Directors can view admission_deals" ON public.admission_deals;
CREATE POLICY "Directors can view admission_deals" ON public.admission_deals FOR SELECT TO authenticated USING (is_director());

DROP POLICY IF EXISTS "Students can view own admission_deal" ON public.admission_deals;
CREATE POLICY "Students can view own admission_deal" ON public.admission_deals FOR SELECT TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students read own admission deals" ON public.admission_deals;
CREATE POLICY "Students read own admission deals" ON public.admission_deals FOR SELECT TO authenticated
  USING (student_email = auth.email() OR student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers and Interviewers have select access to admission_deals" ON public.admission_deals;
CREATE POLICY "Teachers and Interviewers have select access to admission_deals" ON public.admission_deals
  FOR SELECT TO authenticated USING (is_teacher() OR is_interviewer() OR is_admin());

-- ── ADMISSION_DISCOUNTS ──
DROP POLICY IF EXISTS "Admins have full access to admission_discounts" ON public.admission_discounts;
CREATE POLICY "Admins have full access to admission_discounts" ON public.admission_discounts FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Teachers and Interviewers have select access to admission_discounts" ON public.admission_discounts;
CREATE POLICY "Teachers and Interviewers have select access to admission_discounts" ON public.admission_discounts
  FOR SELECT TO authenticated USING (is_teacher() OR is_interviewer() OR is_admin());

-- ── FEE_AGREEMENTS ──
DROP POLICY IF EXISTS "Admins have full access to fee_agreements" ON public.fee_agreements;
CREATE POLICY "Admins have full access to fee_agreements" ON public.fee_agreements FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Teachers and Interviewers have select access to fee_agreements" ON public.fee_agreements;
CREATE POLICY "Teachers and Interviewers have select access to fee_agreements" ON public.fee_agreements
  FOR SELECT TO authenticated USING (is_teacher() OR is_interviewer() OR is_admin());

-- ── PAYMENT_STATUS_TRACKING ──
DROP POLICY IF EXISTS "Admins have full access to payment_status_tracking" ON public.payment_status_tracking;
CREATE POLICY "Admins have full access to payment_status_tracking" ON public.payment_status_tracking FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Teachers and Interviewers have select access to payment_status_tracking" ON public.payment_status_tracking;
CREATE POLICY "Teachers and Interviewers have select access to payment_status_tracking" ON public.payment_status_tracking
  FOR SELECT TO authenticated USING (is_teacher() OR is_interviewer() OR is_admin());

-- ── STUDENT_ENROLLMENTS ──
DROP POLICY IF EXISTS "Admins manage student_enrollments" ON public.student_enrollments;
CREATE POLICY "Admins manage student_enrollments" ON public.student_enrollments FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Teachers view their enrollments" ON public.student_enrollments;
CREATE POLICY "Teachers view their enrollments" ON public.student_enrollments FOR SELECT TO authenticated USING (is_teacher());

DROP POLICY IF EXISTS "Students view own enrollments" ON public.student_enrollments;
CREATE POLICY "Students view own enrollments" ON public.student_enrollments FOR SELECT TO authenticated USING (student_id = auth.uid());

-- ── FORTNIGHT_REVIEWS ──
DROP POLICY IF EXISTS "Admins manage fortnight_reviews" ON public.fortnight_reviews;
CREATE POLICY "Admins manage fortnight_reviews" ON public.fortnight_reviews FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Interviewers manage fortnight_reviews" ON public.fortnight_reviews;
CREATE POLICY "Interviewers manage fortnight_reviews" ON public.fortnight_reviews FOR ALL TO authenticated USING (is_interviewer() OR is_admin()) WITH CHECK (is_interviewer() OR is_admin());

DROP POLICY IF EXISTS "Students view own fortnight_reviews" ON public.fortnight_reviews;
CREATE POLICY "Students view own fortnight_reviews" ON public.fortnight_reviews FOR SELECT TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers view fortnight_reviews" ON public.fortnight_reviews;
CREATE POLICY "Teachers view fortnight_reviews" ON public.fortnight_reviews FOR SELECT TO authenticated USING (is_teacher());

-- ── STUDENT_PROGRESS_REPORTS ──
DROP POLICY IF EXISTS "Teachers view/insert progress reports" ON public.student_progress_reports;
CREATE POLICY "Teachers view/insert progress reports" ON public.student_progress_reports FOR ALL TO authenticated USING (is_teacher()) WITH CHECK (is_teacher());

DROP POLICY IF EXISTS "Admins manage progress reports" ON public.student_progress_reports;
CREATE POLICY "Admins manage progress reports" ON public.student_progress_reports FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Students view own progress reports" ON public.student_progress_reports;
CREATE POLICY "Students view own progress reports" ON public.student_progress_reports FOR SELECT TO authenticated USING (student_id = auth.uid());

-- ── AUDIT_LOGS ──
DROP POLICY IF EXISTS "Admin read audit logs" ON public.audit_logs;
CREATE POLICY "Admin read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- Trigger: auto-create profile on signup
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_role TEXT := COALESCE(new.raw_user_meta_data->>'role', 'student');
  v_name TEXT := COALESCE(new.raw_user_meta_data->>'name', 'User');
BEGIN
  INSERT INTO public.profiles (id, email, name, role, approved, status)
  VALUES (
    new.id,
    lower(new.email),
    v_name,
    v_role,
    false,
    'pending'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name  = COALESCE(NULLIF(EXCLUDED.name, 'User'), public.profiles.name),
      role  = EXCLUDED.role;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: auto-calculate interview total score
DROP FUNCTION IF EXISTS public.calculate_interview_total() CASCADE;
CREATE OR REPLACE FUNCTION public.calculate_interview_total()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_score := COALESCE(NEW.english, 0) + COALESCE(NEW.communication, 0) +
                     COALESCE(NEW.confidence, 0) + COALESCE(NEW.technical_skills, 0) +
                     COALESCE(NEW.learning_ability, 0);

  IF NEW.total_score >= 40 THEN
    NEW.assigned_level := 'Advanced';
  ELSIF NEW.total_score >= 25 THEN
    NEW.assigned_level := 'Intermediate';
  ELSIF NEW.total_score >= 10 THEN
    NEW.assigned_level := 'Elementary';
  ELSE
    NEW.assigned_level := 'Beginner';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculate_interview_total ON public.interviews;
CREATE TRIGGER trg_calculate_interview_total
  BEFORE INSERT OR UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.calculate_interview_total();

-- Trigger: safety-net for fortnight review scheduling (DISABLED/REMOVED)
DROP TRIGGER IF EXISTS trg_auto_schedule_progress_review ON public.interviews;
DROP FUNCTION IF EXISTS public.auto_schedule_progress_review() CASCADE;

-- Trigger: auto-generate receipt number
DROP FUNCTION IF EXISTS public.generate_receipt_number() CASCADE;
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_year    text;
  v_prefix  text;
  v_next    integer;
BEGIN
  v_year   := to_char(now(), 'YYYY');
  v_prefix := 'RCPT-' || v_year || '-';
  SELECT COALESCE(MAX(SUBSTRING(receipt_number FROM 11)::integer), 0) + 1
  INTO v_next
  FROM public.fee_receipts
  WHERE receipt_number LIKE v_prefix || '%';
  NEW.receipt_number := v_prefix || lpad(v_next::text, 6, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_receipt_number ON public.fee_receipts;
CREATE TRIGGER trg_generate_receipt_number
  BEFORE INSERT ON public.fee_receipts
  FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_number();

-- Trigger: notify student on absence
DROP FUNCTION IF EXISTS public.notify_student_absence() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_student_absence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  course_name   text;
  should_notify boolean := false;
BEGIN
  IF NEW.status <> 'absent' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN should_notify := true;
  ELSIF TG_OP = 'UPDATE' THEN should_notify := (OLD.status IS DISTINCT FROM 'absent');
  END IF;
  IF NOT should_notify THEN RETURN NEW; END IF;

  SELECT name INTO course_name FROM public.courses WHERE id = NEW.course_id;

  INSERT INTO public.notifications (student_id, teacher_id, course_id, attendance_id, user_id, role, notification_type, title, message)
  VALUES (
    NEW.student_id, NEW.teacher_id, NEW.course_id, NEW.id,
    NEW.student_id, 'student', 'Attendance Alert', 'Attendance Alert',
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

-- Trigger: sync course_students from student_enrollments
DROP FUNCTION IF EXISTS public.trg_sync_course_students_from_enrollment() CASCADE;
CREATE OR REPLACE FUNCTION public.trg_sync_course_students_from_enrollment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.status = 'active' THEN
      INSERT INTO public.course_students (course_id, student_id)
      VALUES (NEW.course_id, NEW.student_id)
      ON CONFLICT (course_id, student_id) DO NOTHING;
    ELSE
      DELETE FROM public.course_students WHERE course_id = NEW.course_id AND student_id = NEW.student_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.course_students WHERE course_id = OLD.course_id AND student_id = OLD.student_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_enrollment_to_course_students ON public.student_enrollments;
CREATE TRIGGER trg_sync_enrollment_to_course_students
  AFTER INSERT OR UPDATE OR DELETE ON public.student_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_course_students_from_enrollment();

-- Trigger: sync notifications read/status fields
DROP FUNCTION IF EXISTS public.sync_notification_status() CASCADE;
CREATE OR REPLACE FUNCTION public.sync_notification_status()
RETURNS trigger LANGUAGE plpgsql AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_sync_notification_status ON public.notifications;
CREATE TRIGGER trg_sync_notification_status
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_notification_status();

-- Trigger: audit log for fee_payments
DROP FUNCTION IF EXISTS public.process_audit_log() CASCADE;
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old jsonb := null;
  v_new jsonb := null;
  v_record_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD); v_record_id := OLD.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_record_id := NEW.id;
  ELSE
    v_new := to_jsonb(NEW); v_record_id := NEW.id;
  END IF;
  INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, old_data, new_data)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_old, v_new);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_fee_payments ON public.fee_payments;
CREATE TRIGGER trg_audit_fee_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- updated_at trigger function
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_admission_deals_updated_at ON public.admission_deals;
CREATE TRIGGER set_admission_deals_updated_at
  BEFORE UPDATE ON public.admission_deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_fee_ledger_updated_at ON public.fee_ledger;
CREATE TRIGGER set_fee_ledger_updated_at
  BEFORE UPDATE ON public.fee_ledger FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. RPC FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- delete_user_by_id
-- Comprehensive student/user deletion: removes all related records in dependency order.
-- For students: cleans up every table that references the student_id before deleting
-- the profile and auth account. This is the single authoritative delete workflow.
DROP FUNCTION IF EXISTS public.delete_user_by_id(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.delete_user_by_id(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_role       text;
  v_deal_id    uuid;
BEGIN
  -- 1. Permission check — only approved admins may delete users
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND approved = true
  ) THEN
    RAISE EXCEPTION 'Access Denied: Only approved admins can delete users.';
  END IF;

  -- 2. Determine the role of the user being deleted
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;

  -- ─── STUDENT CLEANUP ───────────────────────────────────────────────────────
  IF v_role = 'student' THEN

    -- 2a. Delete all notifications that target this student as recipient (user_id or student_id)
    DELETE FROM public.notifications
    WHERE user_id = p_user_id OR student_id = p_user_id;

    -- 2b. Delete attendance records for this student
    DELETE FROM public.attendance WHERE student_id = p_user_id;

    -- 2c. Delete fortnight/progress review schedule entries
    DELETE FROM public.fortnight_reviews WHERE student_id = p_user_id;

    -- 2d. Delete teacher-authored progress reports
    DELETE FROM public.student_progress_reports WHERE student_id = p_user_id;

    -- 2e. Delete interviews (sets deleted_at is not enough — full delete for cleanup)
    DELETE FROM public.interviews WHERE student_id = p_user_id;

    -- 2f. Delete course_students entries
    DELETE FROM public.course_students WHERE student_id = p_user_id;

    -- 2g. Delete student_enrollments
    DELETE FROM public.student_enrollments WHERE student_id = p_user_id;

    -- 2h. Delete fee_ledger entries
    DELETE FROM public.fee_ledger WHERE student_id = p_user_id;

    -- 2i. Delete fee_payments (cascades to fee_receipts via ON DELETE CASCADE)
    DELETE FROM public.fee_payments WHERE student_id = p_user_id;

    -- 2j. Delete student_profiles
    DELETE FROM public.student_profiles WHERE id = p_user_id;

    -- 2k. Clean up admission_deals that reference this student
    --     Nullify student_id on the deal (preserving the financial record)
    --     then delete orphaned deal-child tables if the deal itself has no other students
    UPDATE public.admission_deals SET student_id = NULL WHERE student_id = p_user_id;

    -- 2l. Delete audit logs referencing this student
    DELETE FROM public.audit_logs WHERE record_id = p_user_id;

  -- ─── TEACHER CLEANUP ───────────────────────────────────────────────────────
  ELSIF v_role = 'teacher' THEN
    -- Remove courses that have no other teachers after this teacher is removed
    DELETE FROM public.courses
    WHERE id IN (
      SELECT ct.course_id FROM public.course_teachers ct
      WHERE ct.teacher_id = p_user_id
        AND NOT EXISTS (
          SELECT 1 FROM public.course_teachers ct2
          WHERE ct2.course_id = ct.course_id AND ct2.teacher_id <> p_user_id
        )
    );

    -- Remove teacher from remaining courses
    DELETE FROM public.course_teachers WHERE teacher_id = p_user_id;

    -- Nullify assigned_teacher_id in student_profiles
    UPDATE public.student_profiles SET assigned_teacher_id = NULL WHERE assigned_teacher_id = p_user_id;

    -- Remove teacher attendance and salary records
    DELETE FROM public.teacher_attendance WHERE teacher_id = p_user_id;
    DELETE FROM public.teacher_salary_settings WHERE teacher_id = p_user_id;
    DELETE FROM public.salary_deductions WHERE teacher_id = p_user_id;

    -- Delete teacher profile extension
    DELETE FROM public.teacher_profiles WHERE id = p_user_id;

  -- ─── INTERVIEWER CLEANUP ───────────────────────────────────────────────────
  ELSIF v_role = 'interviewer' THEN
    DELETE FROM public.interviewer_profiles WHERE id = p_user_id;
  END IF;

  -- 3. Delete from public.profiles — this cascades to auth.users via ON DELETE CASCADE on profiles
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- 4. Belt-and-suspenders: also delete directly from auth.users in case profile was missing
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- submit_interview_for_review (ASR submits admission interview)
DROP FUNCTION IF EXISTS public.submit_interview_for_review(uuid,uuid,int,int,int,int,int,text,text,text,text,text,uuid,uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.submit_interview_for_review(
  p_student_id          uuid,
  p_interviewer_id      uuid,
  p_english             int,
  p_communication       int,
  p_confidence          int,
  p_technical_skills    int,
  p_learning_ability    int,
  p_assigned_level      text,
  p_strengths           text,
  p_weaknesses          text,
  p_recommendations     text,
  p_notes               text,
  p_recommended_course  uuid DEFAULT NULL,
  p_recommended_teacher uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total  int;
  v_int_id uuid;
  v_admin  RECORD;
  v_email  text;
  v_name   text;
BEGIN
  v_total := p_english + p_communication + p_confidence + p_technical_skills + p_learning_ability;
  SELECT email, name INTO v_email, v_name FROM public.profiles WHERE id = p_student_id;

  INSERT INTO public.interviews (
    student_id, interviewer_id, interview_type, status,
    english, communication, confidence, technical_skills, learning_ability,
    total_score, assigned_level, strengths, weaknesses, recommendations, notes,
    recommended_course_id, recommended_teacher_id,
    student_email, student_name
  ) VALUES (
    p_student_id, p_interviewer_id, 'admission', 'pending_admin_review',
    p_english, p_communication, p_confidence, p_technical_skills, p_learning_ability,
    v_total, p_assigned_level, p_strengths, p_weaknesses, p_recommendations, p_notes,
    p_recommended_course, p_recommended_teacher,
    v_email, v_name
  ) RETURNING id INTO v_int_id;

  -- Update admission_deals status
  UPDATE public.admission_deals
  SET admission_status = 'pending_admin_review', updated_at = NOW()
  WHERE student_id = p_student_id OR lower(student_email) = lower(v_email);

  -- Update student level in student_profiles
  INSERT INTO public.student_profiles (id, level)
  VALUES (p_student_id, p_assigned_level)
  ON CONFLICT (id) DO UPDATE SET level = EXCLUDED.level, updated_at = NOW();

  -- Notify all admins (student_id set so notification cascade-deletes on student removal)
  FOR v_admin IN SELECT id FROM public.profiles WHERE role = 'admin' AND approved = true LOOP
    INSERT INTO public.notifications (user_id, student_id, role, notification_type, title, message, read)
    VALUES (
      v_admin.id, p_student_id, 'admin', 'interview_pending_review',
      'New Interview Requires Review',
      'An ASR has completed an admission interview for ' || COALESCE(v_name, 'a new student') || ' and it is awaiting your review.',
      false
    );
  END LOOP;

  RETURN v_int_id;
END;
$$;

-- approve_student_admission_workflow (Admin approves interview)
DROP FUNCTION IF EXISTS public.approve_student_admission_workflow(uuid,uuid,text,uuid,text,uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.approve_student_admission_workflow(
  p_interview_id uuid,
  p_admin_id     uuid,
  p_notes        text DEFAULT '',
  p_teacher_id   uuid DEFAULT NULL,
  p_class        text DEFAULT NULL,
  p_course_id    uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_interview   RECORD;
  v_student     RECORD;
  v_teacher_id  uuid;
  v_course_id   uuid;
  v_class       text;
  v_deal_id     uuid;
  v_final_fee   numeric;
BEGIN
  SELECT * INTO v_interview FROM public.interviews WHERE id = p_interview_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Interview % not found', p_interview_id; END IF;

  SELECT * INTO v_student FROM public.profiles WHERE id = v_interview.student_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student % not found', v_interview.student_id; END IF;

  SELECT id, course_id, teacher_id, class, final_fee
  INTO v_deal_id, v_course_id, v_teacher_id, v_class, v_final_fee
  FROM public.admission_deals
  WHERE student_id = v_interview.student_id OR lower(student_email) = lower(v_student.email)
  ORDER BY created_at DESC LIMIT 1;

  v_teacher_id := COALESCE(p_teacher_id, v_interview.recommended_teacher_id, v_teacher_id);
  v_course_id  := COALESCE(p_course_id,  v_interview.recommended_course_id,  v_course_id);
  v_class      := COALESCE(p_class, v_class);

  IF v_teacher_id IS NULL AND v_course_id IS NOT NULL THEN
    SELECT teacher_id INTO v_teacher_id FROM public.course_teachers WHERE course_id = v_course_id LIMIT 1;
  END IF;

  -- Approve interview
  UPDATE public.interviews
  SET status = 'admin_approved', admin_reviewed_by = p_admin_id,
      admin_reviewed_at = NOW(), admin_notes = p_notes, updated_at = NOW()
  WHERE id = p_interview_id;

  -- Approve student profile
  UPDATE public.profiles SET approved = true, status = 'approved', updated_at = NOW()
  WHERE id = v_interview.student_id;

  -- Upsert student_profiles
  INSERT INTO public.student_profiles (id, level, assigned_teacher_id, class, updated_at)
  VALUES (v_interview.student_id, COALESCE(v_interview.assigned_level, 'Beginner'), v_teacher_id, v_class, NOW())
  ON CONFLICT (id) DO UPDATE
  SET level = EXCLUDED.level, assigned_teacher_id = EXCLUDED.assigned_teacher_id,
      class = EXCLUDED.class, updated_at = NOW();

  -- Enroll in course
  IF v_course_id IS NOT NULL THEN
    INSERT INTO public.student_enrollments (student_id, course_id, teacher_id, admission_deal_id, status)
    VALUES (v_interview.student_id, v_course_id, v_teacher_id, v_deal_id, 'active')
    ON CONFLICT (student_id, course_id) DO UPDATE SET teacher_id = EXCLUDED.teacher_id, status = 'active';

    INSERT INTO public.course_students (course_id, student_id)
    VALUES (v_course_id, v_interview.student_id)
    ON CONFLICT (course_id, student_id) DO NOTHING;
  END IF;

  -- Update admission deal
  IF v_deal_id IS NOT NULL THEN
    UPDATE public.admission_deals
    SET student_account_status = 'approved_for_signup',
        admission_status = 'approved',
        interview_id = p_interview_id,
        student_id = v_interview.student_id,
        course_id = v_course_id,
        teacher_id = v_teacher_id,
        class = v_class,
        updated_at = NOW()
    WHERE id = v_deal_id;
  END IF;

  -- Initialize fee ledger
  IF v_final_fee IS NOT NULL AND v_final_fee > 0 THEN
    INSERT INTO public.fee_ledger (student_id, total_fee, paid_amount, remaining_balance, remarks, payment_date)
    VALUES (v_interview.student_id, v_final_fee, 0, v_final_fee, 'Initial fee from admission approval', CURRENT_DATE)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.fee_payments (student_id, amount, due_date, status, created_at)
    VALUES (v_interview.student_id, v_final_fee, CURRENT_DATE + INTERVAL '7 days', 'unpaid', NOW())
    ON CONFLICT (student_id, due_date) DO NOTHING;
  END IF;

  -- Schedule fortnight reviews (Only schedule Review #1 initially. Subsequent reviews scheduled dynamically on completion)
  DELETE FROM public.fortnight_reviews WHERE student_id = v_interview.student_id AND completed_at IS NULL;
  INSERT INTO public.fortnight_reviews (student_id, review_number, scheduled_date, created_at)
  VALUES
    (v_interview.student_id, 1, CURRENT_DATE + INTERVAL '15 days', NOW());

  -- Notify teacher (student_id set so notification cascade-deletes on student removal)
  IF v_teacher_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, student_id, role, notification_type, title, message)
    VALUES (v_teacher_id, v_interview.student_id, 'teacher', 'new_student_assigned', 'New Student Assigned',
      'A new student, ' || v_student.name || ', has been admitted and assigned to your class.');
  END IF;
END;
$$;

-- reject_student_admission_workflow
DROP FUNCTION IF EXISTS public.reject_student_admission_workflow(uuid,uuid,text) CASCADE;
CREATE OR REPLACE FUNCTION public.reject_student_admission_workflow(
  p_interview_id uuid,
  p_admin_id     uuid,
  p_notes        text DEFAULT ''
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_interview RECORD;
  v_student   RECORD;
BEGIN
  SELECT * INTO v_interview FROM public.interviews WHERE id = p_interview_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Interview % not found', p_interview_id; END IF;
  SELECT * INTO v_student FROM public.profiles WHERE id = v_interview.student_id;

  UPDATE public.interviews
  SET status = 'admin_rejected', admin_reviewed_by = p_admin_id,
      admin_reviewed_at = NOW(), admin_notes = p_notes, updated_at = NOW()
  WHERE id = p_interview_id;

  UPDATE public.profiles SET approved = false, status = 'rejected', updated_at = NOW()
  WHERE id = v_interview.student_id;

  UPDATE public.admission_deals
  SET student_account_status = 'rejected', admission_status = 'rejected', updated_at = NOW()
  WHERE student_email = v_student.email OR student_id = v_interview.student_id;

  -- Rejection notification (student_id set for cascade-delete on student removal)
  INSERT INTO public.notifications (user_id, student_id, role, notification_type, title, message)
  VALUES (v_interview.student_id, v_interview.student_id, 'student', 'admission_decision', 'Admission Rejected',
    'Your admission has not been approved at this time. Notes: ' || p_notes);
END;
$$;

-- validate_student_signup_eligibility
DROP FUNCTION IF EXISTS public.validate_student_signup_eligibility(text) CASCADE;
CREATE OR REPLACE FUNCTION public.validate_student_signup_eligibility(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email  text := lower(trim(p_email));
  v_deal   RECORD;
BEGIN
  -- 1. Find the most recent admission deal for this email
  SELECT * INTO v_deal FROM public.admission_deals
  WHERE lower(student_email) = v_email ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'admission_deal_not_found');
  END IF;

  -- 2. Primary gate: the deal must be approved and cleared for signup.
  --    This is the authoritative check — if admin approved the workflow, both
  --    admission_status='approved' and student_account_status='approved_for_signup'
  --    are set atomically by approve_student_admission_workflow().
  IF v_deal.admission_status = 'approved'
     AND v_deal.student_account_status IN ('approved_for_signup', 'approved') THEN
    RETURN jsonb_build_object(
      'eligible', true,
      'deal_id', v_deal.id,
      'interview_id', v_deal.interview_id,
      'admission_status', v_deal.admission_status
    );
  END IF;

  -- 3. Not eligible — return a helpful reason
  RETURN jsonb_build_object(
    'eligible', false,
    'reason', CASE
      WHEN v_deal.admission_status NOT IN ('approved') THEN 'interview_or_admin_approval_pending'
      ELSE 'admission_not_approved_for_signup'
    END,
    'deal_id', v_deal.id,
    'admission_status', v_deal.admission_status,
    'student_account_status', v_deal.student_account_status
  );
END;
$$;

-- complete_approved_student_signup
DROP FUNCTION IF EXISTS public.complete_approved_student_signup(text,text,text) CASCADE;
CREATE OR REPLACE FUNCTION public.complete_approved_student_signup(
  p_email    text,
  p_password text,
  p_name     text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
  v_user_id      uuid;
  v_deal         RECORD;
  v_level        text;
  v_class        text;
  v_teacher_name text;
  v_course_name  text;
  v_teacher_id   uuid;
  v_course_id    uuid;
  v_msg          text;
  v_name         text := p_name;
BEGIN
  -- 1. Find the user ID in auth.users by email
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email));

  -- 2. Find the admission deal
  SELECT * INTO v_deal FROM public.admission_deals
  WHERE lower(student_email) = lower(trim(p_email))
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No admission deal found for email %', p_email;
  END IF;

  -- 3. If user doesn't exist, create them (safety fallback)
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, role, aud,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', lower(trim(p_email)), crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', v_name, 'role', 'student'),
      null, now(), now(), 'authenticated', 'authenticated',
      '', '', '', '', '', '', '', '');

    -- Link student_id in admission deal if not already set
    UPDATE public.admission_deals SET student_id = v_user_id WHERE id = v_deal.id;
  ELSE
    -- User exists, update password and metadata
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = jsonb_build_object('name', v_name, 'role', 'student'),
        updated_at = now(),
        is_super_admin = null,
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        phone_change = COALESCE(phone_change, ''),
        phone_change_token = COALESCE(phone_change_token, ''),
        reauthentication_token = COALESCE(reauthentication_token, '')
    WHERE id = v_user_id;
  END IF;

  -- Ensure identity exists in auth.identities
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email)), 'email_verified', false, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO NOTHING;

  -- 4. Update the profiles table
  INSERT INTO public.profiles (id, email, name, role, approved, status)
  VALUES (v_user_id, lower(trim(p_email)), v_name, 'student', true, 'approved')
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, email = EXCLUDED.email, approved = true, status = 'approved', updated_at = now();

  -- 5. Update student account status in admission deals
  UPDATE public.admission_deals
  SET student_account_status = 'account_created',
      student_id = v_user_id,
      updated_at = now()
  WHERE id = v_deal.id;

  -- 6. Get level, class, teacher, course for welcome notification
  SELECT level, class, assigned_teacher_id INTO v_level, v_class, v_teacher_id
  FROM public.student_profiles
  WHERE id = v_user_id;

  IF v_teacher_id IS NOT NULL THEN
    SELECT name INTO v_teacher_name FROM public.profiles WHERE id = v_teacher_id;
  END IF;

  SELECT se.course_id, c.name INTO v_course_id, v_course_name
  FROM public.student_enrollments se
  JOIN public.courses c ON c.id = se.course_id
  WHERE se.student_id = v_user_id AND se.status = 'active'
  LIMIT 1;

  -- Build welcome notification message
  v_msg := 'Welcome! Your admission has been approved.' || E'\n' ||
           'Course: ' || COALESCE(v_course_name, 'Not Assigned') || E'\n' ||
           'Class: ' || COALESCE(v_class, 'Not Assigned') || E'\n' ||
           'Teacher: ' || COALESCE(v_teacher_name, 'Not Assigned') || E'\n' ||
           'Level: ' || COALESCE(v_level, 'Not Assigned');

  -- Insert notification inside existing notification system
  INSERT INTO public.notifications (
    student_id, user_id, role, notification_type, title, message, read, status
  ) VALUES (
    v_user_id, v_user_id, 'student', 'admission_approved', 'Admission Approved', v_msg, false, 'unread'
  )
  ON CONFLICT DO NOTHING;

END;
$$;

-- record_fee_ledger_manual (Director manually records fee collection)
DROP FUNCTION IF EXISTS public.record_fee_ledger_manual(uuid,numeric,numeric,numeric,uuid,text,date) CASCADE;
CREATE OR REPLACE FUNCTION public.record_fee_ledger_manual(
  p_student_id        uuid,
  p_total_fee         numeric,
  p_paid_amount       numeric,
  p_remaining_balance numeric,
  p_collected_by      uuid,
  p_remarks           text DEFAULT '',
  p_payment_date      date DEFAULT CURRENT_DATE
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.fee_ledger (student_id, total_fee, paid_amount, remaining_balance, collected_by, remarks, payment_date)
  VALUES (p_student_id, p_total_fee, p_paid_amount, p_remaining_balance, p_collected_by, p_remarks, p_payment_date)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- get_admin_dashboard_stats
DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats() CASCADE;
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_stats jsonb; v_today date := CURRENT_DATE;
BEGIN
  SELECT jsonb_build_object(
    'teachers',        (SELECT count(*) FROM public.profiles WHERE role = 'teacher' AND approved = true),
    'students',        (SELECT count(*) FROM public.profiles WHERE role = 'student' AND approved = true),
    'courses',         (SELECT count(*) FROM public.courses),
    'interviewers',    (SELECT count(*) FROM public.profiles WHERE role = 'interviewer' AND approved = true),
    'todayAttendance', (SELECT count(*) FROM public.attendance WHERE date = v_today AND status = 'present'),
    'pendingInterviews', (
      SELECT count(*) FROM public.profiles p
      WHERE p.role = 'student' AND p.status IN ('pending','waiting_approval')
        AND NOT EXISTS (SELECT 1 FROM public.interviews i WHERE i.student_id = p.id AND i.interview_type = 'admission' AND i.deleted_at IS NULL)
    ) + (SELECT count(*) FROM public.admission_deals WHERE student_id IS NULL),
    'pendingReviews',  (SELECT count(*) FROM public.interviews WHERE status = 'pending_admin_review' AND deleted_at IS NULL),
    'feeCollections',  (
      COALESCE((SELECT sum(amount) FROM public.fee_payments WHERE status = 'approved' AND deleted_at IS NULL), 0) +
      COALESCE((SELECT sum(final_fee) FROM public.admission_deals WHERE payment_status = 'paid'), 0)
    )
  ) INTO v_stats;
  RETURN v_stats;
END;
$$;

-- notify_due_fortnight_reviews
DROP FUNCTION IF EXISTS public.notify_due_fortnight_reviews() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_due_fortnight_reviews()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_review RECORD; v_asr RECORD; v_admin RECORD; v_count int := 0;
BEGIN
  FOR v_review IN
    SELECT fr.*, p.name AS student_name
    FROM public.fortnight_reviews fr
    JOIN public.profiles p ON p.id = fr.student_id
    WHERE fr.scheduled_date <= CURRENT_DATE AND fr.completed_at IS NULL
  LOOP
    -- Notify all ASR / Interviewers
    FOR v_asr IN SELECT id FROM public.profiles WHERE role = 'interviewer' AND approved = true LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE user_id = v_asr.id 
          AND notification_type = 'fortnight_review_due' 
          AND message = 'Review #' || v_review.review_number || ' for ' || v_review.student_name || ' is due today.'
      ) THEN
        INSERT INTO public.notifications (user_id, student_id, role, notification_type, title, message, read)
        VALUES (v_asr.id, v_review.student_id, 'interviewer', 'fortnight_review_due', 'Fortnight Review Due',
          'Review #' || v_review.review_number || ' for ' || v_review.student_name || ' is due today.', false);
      END IF;
    END LOOP;
    -- Notify all Admins
    FOR v_admin IN SELECT id FROM public.profiles WHERE role = 'admin' AND approved = true LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE user_id = v_admin.id 
          AND notification_type = 'fortnight_review_due' 
          AND message = 'Review #' || v_review.review_number || ' for ' || v_review.student_name || ' is overdue and not yet completed.'
      ) THEN
        INSERT INTO public.notifications (user_id, student_id, role, notification_type, title, message, read)
        VALUES (v_admin.id, v_review.student_id, 'admin', 'fortnight_review_due', 'Fortnight Review Overdue',
          'Review #' || v_review.review_number || ' for ' || v_review.student_name || ' is overdue and not yet completed.', false);
      END IF;
    END LOOP;
    -- Notify the Student
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE user_id = v_review.student_id 
        AND notification_type = 'progress_review_due' 
        AND message = 'Your Day-' || (v_review.review_number * 15) || ' progress review is scheduled for today.'
    ) THEN
      INSERT INTO public.notifications (user_id, student_id, role, notification_type, title, message, read)
      VALUES (v_review.student_id, v_review.student_id, 'student', 'progress_review_due', 'Your Progress Review is Due',
        'Your Day-' || (v_review.review_number * 15) || ' progress review is scheduled for today.', false);
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- create_student_from_admission (Admin/ASR creates a placeholder account)
DROP FUNCTION IF EXISTS public.create_student_from_admission(text,text,text,text,text,uuid,text,uuid,uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.create_student_from_admission(
  p_email       text,
  p_name        text,
  p_father_name text,
  p_phone       text,
  p_whatsapp    text,
  p_course_id   uuid,
  p_class       text,
  p_teacher_id  uuid,
  p_deal_id     uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
  v_user_id      uuid;
  v_temp_pw_hash text;
  v_email        text := lower(trim(p_email));
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email;

  IF v_user_id IS NULL THEN
    v_user_id      := gen_random_uuid();
    v_temp_pw_hash := crypt(gen_random_uuid()::text, gen_salt('bf'));

    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, role, aud,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', v_email, v_temp_pw_hash, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', p_name, 'role', 'student', 'internal_admission_placeholder', true),
      null, now(), now(), 'authenticated', 'authenticated',
      '', '', '', '', '', '', '', '');
  END IF;

  -- Ensure identity exists in auth.identities
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', false, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO NOTHING;

  INSERT INTO public.profiles (id, email, name, role, approved, status)
  VALUES (v_user_id, v_email, p_name, 'student', false, 'pending')
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, name = EXCLUDED.name, role = 'student', status = 'pending';

  INSERT INTO public.student_profiles (id, email, assigned_teacher_id, class, created_at, updated_at)
  VALUES (v_user_id, v_email, p_teacher_id, p_class, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, assigned_teacher_id = EXCLUDED.assigned_teacher_id, class = EXCLUDED.class, updated_at = now();

  UPDATE public.admission_deals
  SET student_id = v_user_id, student_account_status = 'pending', updated_at = NOW()
  WHERE id = p_deal_id;

  RETURN v_user_id;
END;
$$;

-- create_absence_notification (Teacher-initiated RPC)
DROP FUNCTION IF EXISTS public.create_absence_notification(uuid,uuid,uuid,uuid,text) CASCADE;
CREATE OR REPLACE FUNCTION public.create_absence_notification(
  p_student_id   uuid,
  p_teacher_id   uuid,
  p_course_id    uuid,
  p_attendance_id uuid,
  p_message      text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_teacher_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.course_teachers WHERE course_id = p_course_id AND teacher_id = p_teacher_id) THEN
    RAISE EXCEPTION 'Teacher not assigned to this course';
  END IF;
  INSERT INTO public.notifications (student_id, teacher_id, course_id, attendance_id, user_id, role, notification_type, title, message)
  VALUES (p_student_id, p_teacher_id, p_course_id, p_attendance_id, p_student_id, 'student', 'Attendance Alert', 'Attendance Alert', p_message)
  ON CONFLICT (attendance_id) WHERE attendance_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. GRANT EXECUTE
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_interviewer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_director() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_interview_for_review(uuid,uuid,int,int,int,int,int,text,text,text,text,text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_student_admission_workflow(uuid,uuid,text,uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_student_admission_workflow(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_student_signup_eligibility(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_approved_student_signup(text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_fee_ledger_manual(uuid,numeric,numeric,numeric,uuid,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_due_fortnight_reviews() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_from_admission(text,text,text,text,text,uuid,text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_absence_notification(uuid,uuid,uuid,uuid,text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. REALTIME
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'SUCCESS: Master SQL applied. All GEMINI.md business rules are live.' AS status;
