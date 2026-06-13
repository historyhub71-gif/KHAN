-- =============================================================================
-- ATTENDANCE APP — ADMISSION FEE MANAGEMENT SCHEMA (013)
-- =============================================================================

-- 1. ADMISSION DEALS TABLE
CREATE TABLE IF NOT EXISTS public.admission_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  original_fee numeric NOT NULL CHECK (original_fee >= 0),
  discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0),
  discount_percentage numeric DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  final_fee numeric NOT NULL CHECK (final_fee >= 0),
  payment_status text CHECK (payment_status IN ('pending', 'paid')) DEFAULT 'pending',
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. ADMISSION DISCOUNTS LOG TABLE
CREATE TABLE IF NOT EXISTS public.admission_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.admission_deals(id) ON DELETE CASCADE,
  discount_amount numeric NOT NULL CHECK (discount_amount >= 0),
  discount_percentage numeric NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  remarks text,
  created_at timestamptz DEFAULT now()
);

-- 3. FEE AGREEMENTS LOG TABLE
CREATE TABLE IF NOT EXISTS public.fee_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.admission_deals(id) ON DELETE CASCADE,
  agreed_amount numeric NOT NULL CHECK (agreed_amount >= 0),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 4. PAYMENT STATUS TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.payment_status_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.admission_deals(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'paid')),
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Enable Row Level Security (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.admission_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_status_tracking ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS Policies Definitions
-- -----------------------------------------------------------------------------

-- admission_deals policies
DROP POLICY IF EXISTS "Admins have full access to admission_deals" ON public.admission_deals;
CREATE POLICY "Admins have full access to admission_deals"
  ON public.admission_deals FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers and Interviewers have select access to admission_deals" ON public.admission_deals;
CREATE POLICY "Teachers and Interviewers have select access to admission_deals"
  ON public.admission_deals FOR SELECT TO authenticated
  USING (public.is_teacher() OR public.is_interviewer() OR public.is_admin());

-- admission_discounts policies
DROP POLICY IF EXISTS "Admins have full access to admission_discounts" ON public.admission_discounts;
CREATE POLICY "Admins have full access to admission_discounts"
  ON public.admission_discounts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers and Interviewers have select access to admission_discounts" ON public.admission_discounts;
CREATE POLICY "Teachers and Interviewers have select access to admission_discounts"
  ON public.admission_discounts FOR SELECT TO authenticated
  USING (public.is_teacher() OR public.is_interviewer() OR public.is_admin());

-- fee_agreements policies
DROP POLICY IF EXISTS "Admins have full access to fee_agreements" ON public.fee_agreements;
CREATE POLICY "Admins have full access to fee_agreements"
  ON public.fee_agreements FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers and Interviewers have select access to fee_agreements" ON public.fee_agreements;
CREATE POLICY "Teachers and Interviewers have select access to fee_agreements"
  ON public.fee_agreements FOR SELECT TO authenticated
  USING (public.is_teacher() OR public.is_interviewer() OR public.is_admin());

-- payment_status_tracking policies
DROP POLICY IF EXISTS "Admins have full access to payment_status_tracking" ON public.payment_status_tracking;
CREATE POLICY "Admins have full access to payment_status_tracking"
  ON public.payment_status_tracking FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers and Interviewers have select access to payment_status_tracking" ON public.payment_status_tracking;
CREATE POLICY "Teachers and Interviewers have select access to payment_status_tracking"
  ON public.payment_status_tracking FOR SELECT TO authenticated
  USING (public.is_teacher() OR public.is_interviewer() OR public.is_admin());
