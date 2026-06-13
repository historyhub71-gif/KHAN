-- ============================================================
-- MIGRATION 018 – FEE SYSTEM RESTRUCTURE
-- • Remove Teacher fee collection (teachers cannot submit fees)
-- • Remove Admin fee approval (Director collects → instantly PAID)
-- • Add manual remaining_balance to fee_ledger (no auto-calc)
-- • Fix ASR dashboard query (pending students = approved=false)
-- • Add approve_student_admission_workflow RPC
-- • Expand notification_type check to cover new types
-- ============================================================

-- ============================================================
-- 0. EXTEND notification_type CHECK (add new types)
-- ============================================================
DO $$
BEGIN
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
    'progress_report',
    'student_admitted',
    'fee_collected'
  ));

-- ============================================================
-- 1. FEE PAYMENTS CONSTRAINT & STATUS UPDATE
--    Drop the old check constraint on fee_payments.status and set up a new constraint allowing only ('unpaid', 'paid') (replacing 'approved' with 'paid').
--    Update existing 'approved' payments to 'paid'.
-- ============================================================
UPDATE public.fee_payments SET status = 'paid' WHERE status = 'approved';
UPDATE public.fee_payments SET status = 'unpaid' WHERE status NOT IN ('unpaid', 'paid');

DO $$
DECLARE
  rname text;
BEGIN
  SELECT conname INTO rname
  FROM pg_constraint
  WHERE conrelid = 'public.fee_payments'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%';
  IF rname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.fee_payments DROP CONSTRAINT ' || quote_ident(rname);
  END IF;
END $$;

ALTER TABLE public.fee_payments
  ADD CONSTRAINT fee_payments_status_check
  CHECK (status IN ('unpaid', 'paid'));

-- ============================================================
-- 2. FEE LEDGER: Add director_insert policy so Directors can INSERT
-- ============================================================
DROP POLICY IF EXISTS "Directors insert fee_ledger" ON fee_ledger;
CREATE POLICY "Directors insert fee_ledger"
  ON fee_ledger FOR INSERT
  WITH CHECK (is_director());

DROP POLICY IF EXISTS "Directors manage fee_ledger" ON fee_ledger;
CREATE POLICY "Directors manage fee_ledger"
  ON fee_ledger FOR ALL
  USING (is_director()) WITH CHECK (is_director());

-- ============================================================
-- 3. RPC: record_fee_ledger_manual
--    Director supplies remaining_balance manually (no auto-calc)
-- ============================================================
CREATE OR REPLACE FUNCTION record_fee_ledger_manual(
  p_student_id       UUID,
  p_total_fee        NUMERIC,
  p_paid_amount      NUMERIC,
  p_remaining_balance NUMERIC,
  p_collected_by     UUID,
  p_remarks          TEXT DEFAULT '',
  p_payment_date     DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_id          UUID;
  v_student_name TEXT;
BEGIN
  INSERT INTO fee_ledger (
    student_id, total_fee, paid_amount, remaining_balance,
    collected_by, remarks, payment_date
  )
  VALUES (
    p_student_id, p_total_fee, p_paid_amount, p_remaining_balance,
    p_collected_by, p_remarks, p_payment_date
  )
  RETURNING id INTO v_id;

  -- Fetch student name for notification
  SELECT name INTO v_student_name FROM profiles WHERE id = p_student_id;

  -- Notify student
  INSERT INTO notifications (user_id, role, notification_type, title, message, read)
  VALUES (
    p_student_id, 'student', 'fee_ledger_updated',
    'Fee Payment Recorded',
    'Dear ' || COALESCE(v_student_name, 'Student') || ', a payment of Rs. ' || p_paid_amount::text ||
    ' has been recorded. Remaining balance: Rs. ' || p_remaining_balance::text || '.',
    false
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_fee_ledger_manual(UUID, NUMERIC, NUMERIC, NUMERIC, UUID, TEXT, DATE) TO authenticated;

-- ============================================================
-- 4. RPC: approve_student_admission_workflow
--    Admin approves interview → marks student approved=true,
--    schedules fortnight reviews, notifies teacher + student
-- ============================================================
DROP FUNCTION IF EXISTS approve_student_admission_workflow(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION approve_student_admission_workflow(
  p_interview_id    UUID,
  p_admin_id        UUID,
  p_notes           TEXT DEFAULT '',
  p_teacher_id      UUID DEFAULT NULL,
  p_class           TEXT DEFAULT NULL,
  p_course_id       UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_interview        RECORD;
  v_student          RECORD;
  v_teacher_id       UUID;
  v_course_id        UUID;
  v_class            TEXT;
  v_final_fee        NUMERIC;
  v_teacher_notification_msg TEXT;
BEGIN
  -- Fetch interview details
  SELECT * INTO v_interview FROM interviews WHERE id = p_interview_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interview % not found', p_interview_id;
  END IF;

  -- Fetch student details
  SELECT * INTO v_student FROM profiles WHERE id = v_interview.student_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student % not found', v_interview.student_id;
  END IF;

  -- Determine teacher, course, class
  v_teacher_id := COALESCE(p_teacher_id, v_interview.recommended_teacher_id);
  v_course_id := COALESCE(p_course_id, v_interview.recommended_course_id);
  v_class := p_class;

  IF v_class IS NULL THEN
    SELECT class INTO v_class
    FROM public.admission_deals
    WHERE student_id = v_interview.student_id OR student_email = v_student.email
    LIMIT 1;
  END IF;

  -- Mark interview as admin_approved
  UPDATE interviews
  SET
    status            = 'admin_approved',
    admin_reviewed_by = p_admin_id,
    admin_reviewed_at = NOW(),
    admin_notes       = p_notes,
    updated_at        = NOW()
  WHERE id = p_interview_id;

  -- Mark student as approved in profiles
  UPDATE profiles
  SET
    approved   = true,
    status     = 'approved',
    updated_at = NOW()
  WHERE id = v_interview.student_id;

  -- Update student_profiles level, teacher, and class
  INSERT INTO student_profiles (id, level, assigned_teacher_id, class)
  VALUES (
    v_interview.student_id,
    COALESCE(v_interview.assigned_level, 'Beginner'),
    v_teacher_id,
    v_class
  )
  ON CONFLICT (id) DO UPDATE
    SET level = EXCLUDED.level,
        assigned_teacher_id = EXCLUDED.assigned_teacher_id,
        class = EXCLUDED.class,
        updated_at = NOW();

  -- Enroll student in recommended course if specified
  IF v_course_id IS NOT NULL THEN
    INSERT INTO student_enrollments (student_id, course_id, teacher_id, admission_deal_id)
    VALUES (
      v_interview.student_id,
      v_course_id,
      v_teacher_id,
      NULL
    )
    ON CONFLICT (student_id, course_id) DO NOTHING;

    -- Also insert into course_students for backward compat
    INSERT INTO course_students (course_id, student_id)
    VALUES (v_course_id, v_interview.student_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Schedule 3 fortnight reviews
  DELETE FROM fortnight_reviews
  WHERE student_id = v_interview.student_id AND completed_at IS NULL;

  INSERT INTO fortnight_reviews (student_id, review_number, scheduled_date, interview_id)
  VALUES
    (v_interview.student_id, 1, CURRENT_DATE + INTERVAL '15 days', p_interview_id),
    (v_interview.student_id, 2, CURRENT_DATE + INTERVAL '30 days', p_interview_id),
    (v_interview.student_id, 3, CURRENT_DATE + INTERVAL '45 days', p_interview_id);

  -- Create an initial fee ledger record and fee payment (unpaid status)
  SELECT COALESCE(final_fee, 15000) INTO v_final_fee
  FROM public.admission_deals
  WHERE student_id = v_interview.student_id OR student_email = v_student.email
  LIMIT 1;

  IF v_final_fee IS NULL THEN
    v_final_fee := 15000;
  END IF;

  INSERT INTO public.fee_ledger (student_id, total_fee, paid_amount, remaining_balance, remarks, payment_date)
  VALUES (
    v_interview.student_id,
    v_final_fee,
    0,
    v_final_fee,
    'Initial fee ledger record on admission approval',
    CURRENT_DATE
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.fee_payments (student_id, amount, due_date, status)
  VALUES (
    v_interview.student_id,
    v_final_fee,
    (CURRENT_DATE + INTERVAL '10 days')::date,
    'unpaid'
  )
  ON CONFLICT DO NOTHING;

  -- Notify the assigned teacher with candidate details (strengths, weaknesses, recommendations, level, class, and ID)
  IF v_teacher_id IS NOT NULL THEN
    v_teacher_notification_msg := 'New student assigned to you: ' || COALESCE(v_student.name, 'Student') || 
      ' (ID: ' || v_interview.student_id::text || '). Class: ' || COALESCE(v_class, 'N/A') || 
      ', Level: ' || COALESCE(v_interview.assigned_level, 'Beginner') || 
      ', Strengths: ' || COALESCE(v_interview.strengths, 'N/A') || 
      ', Weaknesses: ' || COALESCE(v_interview.weaknesses, 'N/A') || 
      ', Recommendations: ' || COALESCE(v_interview.recommendations, 'N/A') || '.';

    INSERT INTO notifications (user_id, role, notification_type, title, message, read)
    VALUES (
      v_teacher_id, 'teacher', 'new_student_assigned',
      'New Student Assigned',
      v_teacher_notification_msg,
      false
    );
  END IF;

  -- Notify student: admission approved
  INSERT INTO notifications (user_id, role, notification_type, title, message, read)
  VALUES (
    v_interview.student_id, 'student', 'admission_approved',
    'Congratulations! Admission Approved',
    'Your admission has been approved by the Admin. Welcome to our institution! Your progress reviews and initial fee details are ready.',
    false
  );

  -- Notify ASR who conducted the interview
  IF v_interview.interviewer_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, role, notification_type, title, message, read)
    VALUES (
      v_interview.interviewer_id, 'interviewer', 'interview_reviewed',
      'Interview Approved',
      'The interview you submitted for ' || COALESCE(v_student.name, 'a student') ||
      ' has been approved by Admin.',
      false
    );
  END IF;

END;
$$;

GRANT EXECUTE ON FUNCTION approve_student_admission_workflow(UUID, UUID, TEXT, UUID, TEXT, UUID) TO authenticated;

-- ============================================================
-- 5. RPC: reject_student_admission_workflow
--    Admin rejects interview → notifies student + ASR
-- ============================================================
CREATE OR REPLACE FUNCTION reject_student_admission_workflow(
  p_interview_id UUID,
  p_admin_id     UUID,
  p_notes        TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_interview RECORD;
  v_student   RECORD;
BEGIN
  SELECT * INTO v_interview FROM interviews WHERE id = p_interview_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Interview % not found', p_interview_id; END IF;

  SELECT * INTO v_student FROM profiles WHERE id = v_interview.student_id;

  UPDATE interviews
  SET
    status            = 'admin_rejected',
    admin_reviewed_by = p_admin_id,
    admin_reviewed_at = NOW(),
    admin_notes       = p_notes,
    updated_at        = NOW()
  WHERE id = p_interview_id;

  -- Notify student
  INSERT INTO notifications (user_id, role, notification_type, title, message, read)
  VALUES (
    v_interview.student_id, 'student', 'admission_decision',
    'Admission Status Updated',
    'Your admission interview has been reviewed. Please contact the institute for further information. Reason: ' || COALESCE(p_notes, 'See admin for details'),
    false
  );

  -- Notify ASR
  IF v_interview.interviewer_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, role, notification_type, title, message, read)
    VALUES (
      v_interview.interviewer_id, 'interviewer', 'interview_reviewed',
      'Interview Not Approved',
      'The interview you submitted for ' || COALESCE(v_student.name, 'a student') ||
      ' was not approved by Admin. Reason: ' || COALESCE(p_notes, 'N/A'),
      false
    );
  END IF;

END;
$$;

GRANT EXECUTE ON FUNCTION reject_student_admission_workflow(UUID, UUID, TEXT) TO authenticated;

-- ============================================================
-- 6. TRIGGER: trg_auto_schedule_next_progress_review
--    Automate the fortnight review cycle. When a progress review
--    is completed, the next is scheduled 14 days later.
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_schedule_next_progress_review()
RETURNS trigger AS $$
DECLARE
  v_next_review_number INT;
  v_is_completed BOOLEAN;
BEGIN
  -- Check if completed (either inserted as completed/admin_approved, or status updated to completed/admin_approved)
  v_is_completed := (NEW.status IN ('completed', 'admin_approved') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status));

  IF NEW.interview_type = 'progress_review' AND NEW.deleted_at IS NULL AND v_is_completed THEN
    -- Find the last review number for this student in fortnight_reviews
    SELECT COALESCE(MAX(review_number), 0) + 1 INTO v_next_review_number
    FROM public.fortnight_reviews
    WHERE student_id = NEW.student_id;

    -- Schedule the next progress review 14 days later
    INSERT INTO public.fortnight_reviews (student_id, review_number, scheduled_date, interview_id)
    VALUES (
      NEW.student_id,
      v_next_review_number,
      (CURRENT_DATE + INTERVAL '14 days')::date,
      NEW.id
    )
    ON CONFLICT DO NOTHING;

    -- Notify student about the new review scheduled
    INSERT INTO notifications (user_id, role, notification_type, title, message, read)
    VALUES (
      NEW.student_id, 'student', 'review_scheduled',
      'Next Progress Review Scheduled',
      'Your next progress review (#' || v_next_review_number || ') has been scheduled for ' || (CURRENT_DATE + INTERVAL '14 days')::date::text || '.',
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_schedule_next_progress_review ON public.interviews;
CREATE TRIGGER trg_auto_schedule_next_progress_review
  AFTER INSERT OR UPDATE OF status ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.auto_schedule_next_progress_review();

-- ============================================================
-- 7. PROFILES: ensure status column has proper values
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND conname LIKE '%status%'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('pending', 'waiting_approval', 'approved', 'rejected') OR status IS NULL);
