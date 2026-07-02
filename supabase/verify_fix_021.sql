-- ============================================================
-- VERIFICATION SCRIPT: AUDIT CURRENT DATA INTEGRITY
-- ============================================================

-- 1. Find Orphan Student Profiles (Missing name in profiles)
SELECT sp.id, sp.level, p.name 
FROM student_profiles sp
LEFT JOIN profiles p ON sp.id = p.id
WHERE p.name IS NULL;

-- 2. Find Admission Deals without linked students (Pre-signup state)
SELECT id, student_name, student_email, created_at 
FROM admission_deals 
WHERE student_id IS NULL;

-- 3. Check for Broken Course Enrollments
SELECT se.student_id, p.name as student_name, se.course_id, c.name as course_name
FROM student_enrollments se
LEFT JOIN profiles p ON se.student_id = p.id
LEFT JOIN courses c ON se.course_id = c.id
WHERE p.id IS NULL OR c.id IS NULL;

-- 4. Verify Dashboard Statistics RPC Output
SELECT get_admin_dashboard_stats();

-- 5. Find Notifications without associated User ID
SELECT id, student_id, user_id, title, role 
FROM notifications 
WHERE user_id IS NULL;

-- 6. Check for pending interviews that should be in Admin Dashboard
SELECT i.id, i.student_id, p.name, i.status 
FROM interviews i
JOIN profiles p ON i.student_id = p.id
WHERE i.status = 'pending_admin_review';

-- 7. Find students who signed up but have no admission interview
SELECT p.id, p.name, p.email, p.created_at
FROM profiles p
WHERE p.role = 'student' 
AND NOT EXISTS (SELECT 1 FROM interviews i WHERE i.student_id = p.id AND i.interview_type = 'admission')
AND p.status = 'waiting_approval';
