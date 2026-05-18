-- Migration 007: Allow students to view teacher profiles
DROP POLICY IF EXISTS "Students can view teacher profiles" ON public.profiles;

CREATE POLICY "Students can view teacher profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    role = 'teacher' AND approved = true
  );

SELECT 'Profiles select policy added successfully!' AS status;
