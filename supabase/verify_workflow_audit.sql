
-- ============================================================
-- VERIFICATION SQL: AUDIT DASHBOARD & WORKFLOW INTEGRITY
-- ============================================================

-- 1. Check for missing student names in teacher dashboard view
SELECT p.id, p.name, p.email, sp.assigned_teacher_id
FROM public.profiles p
JOIN public.student_profiles sp ON sp.id = p.id
WHERE p.role = 'student' AND (p.name IS NULL OR p.name = 'Unknown' OR p.name = '');

-- 2. Check for broken assignments (enrolled in course but no teacher assigned in profile)
SELECT ce.student_id, ce.course_id, ce.teacher_id as enrolled_teacher, sp.assigned_teacher_id as profile_teacher
FROM public.student_enrollments ce
LEFT JOIN public.student_profiles sp ON sp.id = ce.student_id
WHERE ce.teacher_id != sp.assigned_teacher_id OR sp.assigned_teacher_id IS NULL;

-- 3. Check for students missing from Attendance sheets
-- (Students enrolled in a course but not present in course_students)
SELECT se.student_id, se.course_id
FROM public.student_enrollments se
LEFT JOIN public.course_students cs ON cs.course_id = se.course_id AND cs.student_id = se.student_id
WHERE cs.student_id IS NULL;

-- 4. Audit Dashboard Counts
SELECT 
  'Awaiting Admin Admit (Interviews)' as stat, count(*) as actual_count
FROM public.interviews WHERE status = 'pending_admin_review' AND deleted_at IS NULL
UNION ALL
SELECT 
  'Students Requiring Interview' as stat, count(*)
FROM public.profiles p
WHERE p.role = 'student' AND p.status = 'waiting_approval'
AND NOT EXISTS (SELECT 1 FROM interviews i WHERE i.student_id = p.id AND i.interview_type = 'admission')
UNION ALL
SELECT 
  'Unlinked Admission Deals' as stat, count(*)
FROM public.admission_deals WHERE student_id IS NULL;

-- 5. Check Failed Notifications (Notifications with no recipient profile)
SELECT n.id, n.user_id, n.title, n.message
FROM public.notifications n
LEFT JOIN public.profiles p ON p.id = n.user_id
WHERE p.id IS NULL;

-- 6. Check for duplicate active enrollments
SELECT student_id, course_id, count(*)
FROM public.student_enrollments
WHERE status = 'active'
GROUP BY student_id, course_id
HAVING count(*) > 1;
