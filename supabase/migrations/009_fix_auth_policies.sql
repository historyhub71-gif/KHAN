-- Migration 009: Fix profiles RLS policies to allow pending/rejected users to read their own profiles and sign up smoothly
DROP POLICY IF EXISTS "Users can read own profile or admin/teacher" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- 1. Allow any authenticated user to read their own profile, approved or not
CREATE POLICY "Users can read own profile or admin/teacher" ON public.profiles
  FOR SELECT TO authenticated USING (
    id = auth.uid() OR public.is_admin() OR public.is_teacher()
  );

-- 2. Allow any user (authenticated or anon) to insert their own profile during signup
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

SELECT 'Auth policies fixed successfully!' AS status;
