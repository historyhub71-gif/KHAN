-- =============================================================================
-- HASHIR KHAN ATTENDANCE APP — FIX PROFILES ROLES & HELPERS MIGRATION (016)
-- Fixes the check constraint "profiles_role_check" violation issue.
-- =============================================================================

-- 1. DYNAMICALLY DROP ALL OLD ROLE CHECK CONSTRAINTS
-- This dynamically searches for and drops any check constraints on profiles related to the 'role' column.
DO $$
DECLARE
    rname text;
BEGIN
    FOR rname IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.profiles'::regclass 
          AND contype = 'c' 
          AND (conname LIKE '%role%' OR pg_get_constraintdef(oid) LIKE '%role%')
    LOOP
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS ' || quote_ident(rname);
    END LOOP;
END $$;

-- 2. DATA SANITIZATION / REPAIR (PRODUCTION SAFE)
-- Fix any NULL or invalid roles. Valid roles are: 'admin', 'teacher', 'student', 'interviewer', 'director'.
-- Any other role is sanitized to 'student' to satisfy the constraint without losing valid roles.
UPDATE public.profiles
SET role = 'student'
WHERE role IS NULL 
   OR role NOT IN ('admin', 'teacher', 'student', 'interviewer', 'director');

-- 3. APPLY CORRECTED ROLE CHECK CONSTRAINT
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'teacher', 'student', 'interviewer', 'director'));

-- 4. ENSURE HELPER FUNCTIONS EXIST AND ARE CORRECT
CREATE OR REPLACE FUNCTION public.is_interviewer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'interviewer' AND approved = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_director()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'director' AND approved = true
  );
$$;

SELECT 'Migration 016 applied successfully. Role constraints and helper functions are fixed!' AS status;
