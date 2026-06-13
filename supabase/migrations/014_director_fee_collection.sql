-- =============================================================================
-- HASHIR KHAN ATTENDANCE APP — DIRECTOR FEE COLLECTION MIGRATION (014)
-- Paste in Supabase Dashboard → SQL Editor → Run
-- =============================================================================

-- 1. DROP AND RE-ADD ROLE CONSTRAINT TO INCLUDE 'director'
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

-- 2. CREATE is_director() HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.is_director()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'director' AND approved = true
  );
$$;

-- 3. ADD AUDIT COLUMNS TO fee_payments
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS balance_before numeric DEFAULT 0;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS balance_after numeric DEFAULT 0;

-- 4. UPDATE SELECT POLICY FOR profiles TABLE TO INCLUDE DIRECTOR/INTERVIEWER
DROP POLICY IF EXISTS "Users can read own profile or admin/teacher" ON public.profiles;
CREATE POLICY "Users can read own profile or admin/teacher" ON public.profiles
  FOR SELECT TO authenticated USING (
    id = auth.uid() 
    OR public.is_admin() 
    OR public.is_teacher() 
    OR public.is_director() 
    OR public.is_interviewer()
  );

-- 5. CREATE OR UPDATE RLS POLICIES ON fee_payments FOR DIRECTOR
DROP POLICY IF EXISTS "Director manage all fee payments" ON public.fee_payments;
CREATE POLICY "Director manage all fee payments" ON public.fee_payments
  FOR ALL TO authenticated USING (
    public.is_director() 
    OR public.is_admin()
  );

-- 6. CREATE OR UPDATE RLS POLICIES ON fee_receipts FOR DIRECTOR
DROP POLICY IF EXISTS "Director manage all receipts" ON public.fee_receipts;
CREATE POLICY "Director manage all receipts" ON public.fee_receipts
  FOR ALL TO authenticated USING (
    public.is_director() 
    OR public.is_admin()
  );

SELECT 'Director fee collection migration applied successfully!' AS status;
