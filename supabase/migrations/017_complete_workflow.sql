-- ============================================================
-- MIGRATION 017 – COMPLETE WORKFLOW RESTRUCTURE
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 0. EXTEND notification_type CHECK CONSTRAINT
--    (add new types used by the RPCs in this migration)
-- ============================================================
DO $$
BEGIN
  -- Drop old check constraint on notifications.notification_type if it exists,
  -- then re-add an expanded version that includes all types used across migrations.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c'
      AND conname LIKE '%notification_type%'
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
  END IF;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN (
    'Monthly Fee Due Reminder',
    'Fee Overdue Reminder',
    'Payment Received Confirmation',
    'Fee Approval/Rejection Notification',
    'Attendance Alert',
    'interview_completed',
    'progress_review_due',
    'payment_approved',
    'payment_rejected',
    'interview_pending_review',
    'admission_decision',
    'interview_reviewed',
    'review_scheduled',
    'fortnight_review_due',
    'fee_ledger_updated',
    'admission_approved',
    'new_student_assigned',
    'progress_report'
  ));

-- ============================================================
-- 1. ADMISSION DEALS TABLE (with student_email & student_id link)
-- ============================================================
CREATE TABLE IF NOT EXISTS admission_deals (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name           TEXT NOT NULL,
  student_email          TEXT NOT NULL,
  student_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  father_name            TEXT,
  phone_number           TEXT,
  whatsapp_number        TEXT,
  course_id              UUID REFERENCES courses(id) ON DELETE SET NULL,
  teacher_id             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  class                  TEXT,
  original_fee           NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_percentage    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  final_fee              NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status         TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid')),
  remarks                TEXT DEFAULT '',
  admission_status       TEXT NOT NULL DEFAULT 'pending' CHECK (
                           admission_status IN ('pending','pending_admin_review','approved','rejected')
                         ),
  interview_id           UUID REFERENCES interviews(id) ON DELETE SET NULL,
  created_by             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admission_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage admission_deals" ON admission_deals;
DROP POLICY IF EXISTS "Interviewers can view and update admission_deals" ON admission_deals;
DROP POLICY IF EXISTS "Directors can view admission_deals" ON admission_deals;
DROP POLICY IF EXISTS "Students can view own admission_deal" ON admission_deals;

CREATE POLICY "Admins can manage admission_deals"
  ON admission_deals FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Interviewers can view and update admission_deals"
  ON admission_deals FOR ALL
  USING (is_interviewer()) WITH CHECK (is_interviewer());

CREATE POLICY "Directors can view admission_deals"
  ON admission_deals FOR SELECT
  USING (is_director());

CREATE POLICY "Students can view own admission_deal"
  ON admission_deals FOR SELECT
  USING (student_id = auth.uid());

-- ============================================================
-- 2. FEE LEDGER TABLE (remaining balance per student)
--    NOTE: remaining_balance is a plain computed column (not GENERATED ALWAYS AS)
--    because migration 015 already created fee_ledger with a plain numeric column,
--    and migration 016's approve_student_admission explicitly INSERTs into it.
-- ============================================================
CREATE TABLE IF NOT EXISTS fee_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_fee         NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  remaining_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  remarks           TEXT,
  collected_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  payment_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fee_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage fee_ledger" ON fee_ledger;
DROP POLICY IF EXISTS "Directors view fee_ledger" ON fee_ledger;
DROP POLICY IF EXISTS "Students view own fee_ledger" ON fee_ledger;

CREATE POLICY "Admins manage fee_ledger"
  ON fee_ledger FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Directors view fee_ledger"
  ON fee_ledger FOR SELECT
  USING (is_director());

CREATE POLICY "Students view own fee_ledger"
  ON fee_ledger FOR SELECT
  USING (student_id = auth.uid());

-- ============================================================
-- 3. INTERVIEW STATUS TRACKING (add fields to interviews)
-- ============================================================
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'
  CHECK (status IN ('draft','completed','pending_admin_review','admin_approved','admin_rejected'));
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS admin_reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMPTZ;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS recommended_course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS recommended_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================================
-- 4. STUDENT PROGRESS REPORTS (teacher-facing)
-- ============================================================
CREATE TABLE IF NOT EXISTS student_progress_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  progress_notes        TEXT,
  improvement_percentage NUMERIC(5,2) DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE student_progress_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers view/insert progress reports" ON student_progress_reports;
DROP POLICY IF EXISTS "Admins manage progress reports" ON student_progress_reports;
DROP POLICY IF EXISTS "Students view own progress reports" ON student_progress_reports;

CREATE POLICY "Teachers view/insert progress reports"
  ON student_progress_reports FOR ALL
  USING (is_teacher()) WITH CHECK (is_teacher());

CREATE POLICY "Admins manage progress reports"
  ON student_progress_reports FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Students view own progress reports"
  ON student_progress_reports FOR SELECT
  USING (student_id = auth.uid());

-- ============================================================
-- 5. STUDENT ENROLLMENTS (Unified enrollment record)
-- ============================================================
CREATE TABLE IF NOT EXISTS student_enrollments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id           UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admission_deal_id   UUID REFERENCES admission_deals(id) ON DELETE SET NULL,
  enrolled_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','completed')),
  UNIQUE(student_id, course_id)
);

ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage student_enrollments" ON student_enrollments;
DROP POLICY IF EXISTS "Teachers view their enrollments" ON student_enrollments;
DROP POLICY IF EXISTS "Students view own enrollments" ON student_enrollments;

CREATE POLICY "Admins manage student_enrollments"
  ON student_enrollments FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Teachers view their enrollments"
  ON student_enrollments FOR SELECT
  USING (is_teacher());

CREATE POLICY "Students view own enrollments"
  ON student_enrollments FOR SELECT
  USING (student_id = auth.uid());

-- ============================================================
-- 6. FORTNIGHT REVIEW SCHEDULE
-- ============================================================
CREATE TABLE IF NOT EXISTS fortnight_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  review_number         INT NOT NULL DEFAULT 1,
  scheduled_date        DATE NOT NULL,
  completed_at          TIMESTAMPTZ,
  interview_id          UUID REFERENCES interviews(id) ON DELETE SET NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fortnight_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage fortnight_reviews" ON fortnight_reviews;
DROP POLICY IF EXISTS "Interviewers manage fortnight_reviews" ON fortnight_reviews;
DROP POLICY IF EXISTS "Students view own fortnight_reviews" ON fortnight_reviews;
DROP POLICY IF EXISTS "Teachers view fortnight_reviews" ON fortnight_reviews;

CREATE POLICY "Admins manage fortnight_reviews"
  ON fortnight_reviews FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Interviewers manage fortnight_reviews"
  ON fortnight_reviews FOR ALL USING (is_interviewer()) WITH CHECK (is_interviewer());

CREATE POLICY "Students view own fortnight_reviews"
  ON fortnight_reviews FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers view fortnight_reviews"
  ON fortnight_reviews FOR SELECT USING (is_teacher());

-- ============================================================
-- 7. RPC: ASR SUBMITS INTERVIEW → triggers Admin notification
-- ============================================================
CREATE OR REPLACE FUNCTION submit_interview_for_review(
  p_student_id          UUID,
  p_interviewer_id      UUID,
  p_english             INT,
  p_communication       INT,
  p_confidence          INT,
  p_technical_skills    INT,
  p_learning_ability    INT,
  p_assigned_level      TEXT,
  p_strengths           TEXT,
  p_weaknesses          TEXT,
  p_recommendations     TEXT,
  p_notes               TEXT,
  p_recommended_course  UUID DEFAULT NULL,
  p_recommended_teacher UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_total   INT;
  v_int_id  UUID;
  v_admin   RECORD;
BEGIN
  v_total := p_english + p_communication + p_confidence + p_technical_skills + p_learning_ability;

  INSERT INTO interviews (
    student_id, interviewer_id, interview_type, status,
    english, communication, confidence, technical_skills, learning_ability,
    total_score, assigned_level, strengths, weaknesses, recommendations, notes,
    recommended_course_id, recommended_teacher_id
  )
  VALUES (
    p_student_id, p_interviewer_id, 'admission', 'pending_admin_review',
    p_english, p_communication, p_confidence, p_technical_skills, p_learning_ability,
    v_total, p_assigned_level, p_strengths, p_weaknesses, p_recommendations, p_notes,
    p_recommended_course, p_recommended_teacher
  )
  RETURNING id INTO v_int_id;

  -- Update student_profiles level
  INSERT INTO student_profiles (id, level) VALUES (p_student_id, p_assigned_level)
  ON CONFLICT (id) DO UPDATE SET level = EXCLUDED.level, updated_at = NOW();

  -- Notify all admins
  FOR v_admin IN SELECT id FROM profiles WHERE role = 'admin' AND approved = true LOOP
    INSERT INTO notifications (user_id, role, notification_type, title, message, read)
    VALUES (
      v_admin.id, 'admin', 'interview_pending_review',
      'New Interview Requires Review',
      'An ASR has completed an admission interview and it is now awaiting your review and approval.',
      false
    );
  END LOOP;

  RETURN v_int_id;
END;
$$;

-- ============================================================
-- 8. RPC: ADMIN APPROVES / REJECTS INTERVIEW
-- ============================================================
CREATE OR REPLACE FUNCTION admin_review_interview(
  p_interview_id UUID,
  p_admin_id UUID,
  p_decision TEXT,
  p_notes TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_interview RECORD;
  v_new_status TEXT;
BEGIN

  SELECT *
  INTO v_interview
  FROM interviews
  WHERE id = p_interview_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;

  IF p_decision = 'approved' THEN
    v_new_status := 'admin_approved';
  ELSE
    v_new_status := 'admin_rejected';
  END IF;

  UPDATE interviews
  SET
    status            = v_new_status,
    admin_reviewed_by = p_admin_id,
    admin_reviewed_at = NOW(),
    admin_notes       = p_notes,
    updated_at        = NOW()
  WHERE id = p_interview_id;

  -- Notify the student
  INSERT INTO notifications (user_id, role, notification_type, title, message, read)
  VALUES (
    v_interview.student_id,
    'student',
    'admission_decision',
    CASE
      WHEN p_decision = 'approved' THEN 'Admission Approved!'
      ELSE 'Admission Status Updated'
    END,
    CASE
      WHEN p_decision = 'approved'
      THEN 'Congratulations! Your admission interview has been approved by the Admin. Welcome aboard!'
      ELSE 'Your admission interview requires further review. Please contact the institute for details.'
    END,
    false
  );

  -- Notify the ASR
  INSERT INTO notifications (user_id, role, notification_type, title, message, read)
  SELECT
    v_interview.interviewer_id, 'interviewer', 'interview_reviewed',
    'Interview Review Complete',
    'The Admin has ' || p_decision || ' the interview you submitted.',
    false
  WHERE v_interview.interviewer_id IS NOT NULL;

END;
$$;

-- ============================================================
-- 9. RPC: SCHEDULE FORTNIGHT REVIEWS AFTER ADMISSION APPROVED
-- ============================================================
CREATE OR REPLACE FUNCTION schedule_fortnight_reviews(
  p_student_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Delete existing pending reviews for the student
  DELETE FROM fortnight_reviews
  WHERE student_id = p_student_id AND completed_at IS NULL;

  -- Create 3 fortnight reviews (15, 30, 45 days after admission)
  INSERT INTO fortnight_reviews (student_id, review_number, scheduled_date)
  VALUES
    (p_student_id, 1, p_start_date + INTERVAL '15 days'),
    (p_student_id, 2, p_start_date + INTERVAL '30 days'),
    (p_student_id, 3, p_start_date + INTERVAL '45 days');

  -- Notify student
  INSERT INTO notifications (user_id, role, notification_type, title, message, read)
  VALUES (
    p_student_id, 'student', 'review_scheduled',
    'Progress Reviews Scheduled',
    'Your 15-day, 30-day, and 45-day progress reviews have been scheduled. Your ASR will conduct them.',
    false
  );
END;
$$;

-- ============================================================
-- 10. RPC: RECORD FEE LEDGER ENTRY
-- ============================================================
CREATE OR REPLACE FUNCTION record_fee_ledger(
  p_student_id   UUID,
  p_total_fee    NUMERIC,
  p_paid_amount  NUMERIC,
  p_collected_by UUID,
  p_remarks      TEXT DEFAULT '',
  p_payment_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO fee_ledger (student_id, total_fee, paid_amount, remaining_balance, collected_by, remarks, payment_date)
  VALUES (p_student_id, p_total_fee, p_paid_amount, p_total_fee - p_paid_amount, p_collected_by, p_remarks, p_payment_date)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- 11. RPC: NOTIFY DUE FORTNIGHT REVIEWS (run daily via cron or admin)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_due_fortnight_reviews()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_review   RECORD;
  v_count    INT := 0;
  v_asr      RECORD;
BEGIN
  FOR v_review IN
    SELECT fr.*, p.name AS student_name
    FROM fortnight_reviews fr
    JOIN profiles p ON p.id = fr.student_id
    WHERE fr.scheduled_date <= CURRENT_DATE
      AND fr.completed_at IS NULL
  LOOP
    -- Notify all ASRs
    FOR v_asr IN SELECT id FROM profiles WHERE role = 'interviewer' AND approved = true LOOP
      INSERT INTO notifications (user_id, role, notification_type, title, message, read)
      VALUES (
        v_asr.id, 'interviewer', 'fortnight_review_due',
        'Fortnight Review Due',
        'Review #' || v_review.review_number || ' for student ' || v_review.student_name || ' is due today.',
        false
      );
    END LOOP;

    -- Notify student
    INSERT INTO notifications (user_id, role, notification_type, title, message, read)
    VALUES (
      v_review.student_id, 'student', 'progress_review_due',
      'Your Progress Review is Due',
      'Your ' || (v_review.review_number * 15) || '-day progress review is scheduled for today.',
      false
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 12. RPC: GET STUDENT COMPLETE PROFILE (for student dashboard)
-- ============================================================
CREATE OR REPLACE FUNCTION get_student_complete_profile(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'profile',        to_jsonb(p),
    'studentProfile', to_jsonb(sp),
    'latestInterview', to_jsonb(iv),
    'courses', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'code', c.code
      ))
      FROM course_students cs
      JOIN courses c ON c.id = cs.course_id
      WHERE cs.student_id = p_student_id
    ),
    'upcomingReviews', (
      SELECT jsonb_agg(to_jsonb(fr) ORDER BY fr.scheduled_date)
      FROM fortnight_reviews fr
      WHERE fr.student_id = p_student_id AND fr.completed_at IS NULL
    ),
    'feeSummary', (
      SELECT jsonb_build_object(
        'totalPaid',    COALESCE(SUM(fp.amount), 0),
        'pendingCount', COUNT(*) FILTER (WHERE fp.status = 'pending'),
        'approvedCount', COUNT(*) FILTER (WHERE fp.status = 'approved')
      )
      FROM fee_payments fp
      WHERE fp.student_id = p_student_id
        AND fp.deleted_at IS NULL
    )
  ) INTO v_result
  FROM profiles p
  LEFT JOIN student_profiles sp ON sp.id = p_student_id
  LEFT JOIN LATERAL (
    SELECT * FROM interviews
    WHERE student_id = p_student_id AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  ) iv ON true
  WHERE p.id = p_student_id;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 13. TRIGGER: updated_at on admission_deals and fee_ledger
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_admission_deals_updated_at ON admission_deals;
CREATE TRIGGER set_admission_deals_updated_at
  BEFORE UPDATE ON admission_deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_fee_ledger_updated_at ON fee_ledger;
CREATE TRIGGER set_fee_ledger_updated_at
  BEFORE UPDATE ON fee_ledger
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 14. GRANT EXECUTE on RPCs to authenticated users
--     Full parameter type signatures are required by PostgreSQL.
-- ============================================================
GRANT EXECUTE ON FUNCTION submit_interview_for_review(UUID, UUID, INT, INT, INT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_review_interview(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_fortnight_reviews(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION record_fee_ledger(UUID, NUMERIC, NUMERIC, UUID, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_due_fortnight_reviews() TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_complete_profile(UUID) TO authenticated;
