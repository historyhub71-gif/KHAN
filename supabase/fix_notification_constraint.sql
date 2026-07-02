-- ============================================================
-- HOTFIX: notifications_notifications_type_check constraint
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Drop both possible old constraint names
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notifications_type_check;

-- 2. Fix any existing rows that would violate the new constraint
UPDATE public.notifications
SET notification_type = CASE
  WHEN notification_type IS NULL OR btrim(notification_type) = ''                                     THEN 'Attendance Alert'
  WHEN lower(btrim(notification_type)) IN ('attendance alert','attendance_alert','absence','absent')   THEN 'Attendance Alert'
  WHEN lower(btrim(notification_type)) IN ('monthly fee due reminder','monthly_fee_due_reminder')      THEN 'Monthly Fee Due Reminder'
  WHEN lower(btrim(notification_type)) IN ('fee overdue reminder','fee_overdue_reminder')               THEN 'Fee Overdue Reminder'
  WHEN lower(btrim(notification_type)) IN ('payment received confirmation','payment_received')          THEN 'Payment Received Confirmation'
  WHEN lower(btrim(notification_type)) IN ('fee approval/rejection notification','fee_rejected')        THEN 'Fee Approval/Rejection Notification'
  ELSE notification_type
END
WHERE notification_type NOT IN (
  'Monthly Fee Due Reminder','Fee Overdue Reminder','Payment Received Confirmation',
  'Fee Approval/Rejection Notification','Attendance Alert',
  'interview_completed','progress_review_due','payment_approved','payment_rejected',
  'interview_pending_review','admission_decision','interview_reviewed',
  'review_scheduled','fortnight_review_due','fee_ledger_updated',
  'admission_approved','new_student_assigned','progress_report','New Student Interview Required'
);

-- Catch-all: any remaining unknown values → 'Attendance Alert'
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

-- 3. Re-add constraint with the full allowed set
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

SELECT 'HOTFIX APPLIED: notifications constraint updated.' AS status;
