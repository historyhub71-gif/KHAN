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
