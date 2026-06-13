-- Migration: Student Onboarding & Account Auto-Creation Workflow
-- 1. Alter admissions/admission_deals table
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS student_email text;
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS student_account_status text CHECK (student_account_status IN ('pending', 'waiting_approval', 'approved', 'rejected')) DEFAULT 'pending';
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS father_name text;
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS whatsapp_number text;
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS class text;
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.admission_deals ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Alter profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_id uuid;

-- 3. Alter student_profiles table
ALTER TABLE public.student_profiles ADD COLUMN IF NOT EXISTS email text;
-- Add unique constraint on email if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_profiles_email_key'
  ) THEN
    ALTER TABLE public.student_profiles ADD CONSTRAINT student_profiles_email_key UNIQUE (email);
  END IF;
END $$;

-- 4. Create function to securely create a student user record from the admission process
CREATE OR REPLACE FUNCTION public.create_student_from_admission(
  p_email text,
  p_name text,
  p_father_name text,
  p_phone text,
  p_whatsapp text,
  p_course_id uuid,
  p_class text,
  p_teacher_id uuid,
  p_deal_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_temp_pw_hash text;
BEGIN
  -- Check if user already exists in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  -- If user does not exist, create them in auth.users
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_temp_pw_hash := crypt(gen_random_uuid()::text, gen_salt('bf'));
    
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      p_email,
      v_temp_pw_hash,
      now(), -- confirm email by default so they can reset password/login after password set
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('name', p_name, 'role', 'student'),
      false,
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
  END IF;

  -- Ensure profile exists (handle_new_user trigger might have done this, but let's be sure or update it)
  INSERT INTO public.profiles (id, email, name, role, approved, status)
  VALUES (v_user_id, p_email, p_name, 'student', false, 'pending')
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, name = EXCLUDED.name, role = 'student';

  -- Ensure student_profile exists
  INSERT INTO public.student_profiles (id, email, assigned_teacher_id, class, created_at, updated_at)
  VALUES (v_user_id, p_email, p_teacher_id, p_class, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, assigned_teacher_id = EXCLUDED.assigned_teacher_id, class = EXCLUDED.class;

  -- Link the student profile back to profiles table
  UPDATE public.profiles SET student_id = v_user_id WHERE id = v_user_id;

  -- Link the admission deal to the student
  UPDATE public.admission_deals
  SET student_id = v_user_id,
      student_account_status = 'pending'
  WHERE id = p_deal_id;

  RETURN v_user_id;
END;
$$;

-- 5. Create function to set password during onboarding (claiming account)
CREATE OR REPLACE FUNCTION public.activate_student_auth(
  p_email text,
  p_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_pw_hash text;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No pending account found for email: %', p_email;
  END IF;

  -- Check if profile is already approved or is pending activation
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = v_user_id AND status = 'approved' AND approved = true
  ) THEN
    RAISE EXCEPTION 'Account is already active. Please log in.';
  END IF;

  -- Hash new password
  v_pw_hash := crypt(p_password, gen_salt('bf'));

  -- Update user password in auth.users
  UPDATE auth.users
  SET encrypted_password = v_pw_hash,
      updated_at = now()
  WHERE id = v_user_id;

  -- Set status in profiles to waiting_approval
  UPDATE public.profiles
  SET status = 'waiting_approval',
      approved = false
  WHERE id = v_user_id;

  -- Set status in admission_deals to waiting_approval
  UPDATE public.admission_deals
  SET student_account_status = 'waiting_approval'
  WHERE student_email = p_email;

  -- Generate a system notification alert for admin
  INSERT INTO public.notifications (
    user_id,
    role,
    notification_type,
    title,
    message,
    read
  )
  SELECT 
    p.id,
    'admin',
    'progress_review_due', -- reusing notification types
    'Pending Approval Action Required',
    'Student ' || p_email || ' has set their password and is waiting for your approval.',
    false
  FROM public.profiles p
  WHERE p.role = 'admin' AND p.approved = true;

  RETURN true;
END;
$$;

-- 6. Create function to approve student admission & handle cascade setup
CREATE OR REPLACE FUNCTION public.approve_student_admission(
  p_student_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email text;
  v_course_id uuid;
  v_class text;
  v_teacher_id uuid;
  v_deal_id uuid;
  v_name text;
BEGIN
  -- Get user email and name
  SELECT email, name INTO v_email, v_name FROM public.profiles WHERE id = p_student_id;

  -- Get deal info
  SELECT id, course_id, class, teacher_id 
  INTO v_deal_id, v_course_id, v_class, v_teacher_id
  FROM public.admission_deals
  WHERE student_email = v_email OR student_id = p_student_id
  LIMIT 1;

  -- Approve student in profiles
  UPDATE public.profiles
  SET approved = true,
      status = 'approved'
  WHERE id = p_student_id;

  -- Update student profile fields
  IF v_class IS NOT NULL OR v_teacher_id IS NOT NULL THEN
    UPDATE public.student_profiles
    SET class = COALESCE(class, v_class),
        assigned_teacher_id = COALESCE(assigned_teacher_id, v_teacher_id),
        updated_at = now()
    WHERE id = p_student_id;
  END IF;

  -- Auto-enroll student in the course
  IF v_course_id IS NOT NULL THEN
    INSERT INTO public.course_students (course_id, student_id)
    VALUES (v_course_id, p_student_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Update admission deal status
  UPDATE public.admission_deals
  SET student_account_status = 'approved',
      student_id = p_student_id
  WHERE student_email = v_email OR student_id = p_student_id;

  -- Create fee ledger record automatically (initial entry)
  IF EXISTS (SELECT 1 FROM public.admission_deals WHERE student_email = v_email) THEN
    DECLARE
      v_final_fee numeric;
      v_is_paid boolean;
    BEGIN
      SELECT final_fee, (payment_status = 'paid') INTO v_final_fee, v_is_paid
      FROM public.admission_deals
      WHERE student_email = v_email OR student_id = p_student_id
      LIMIT 1;

      INSERT INTO public.fee_ledger (student_id, total_fee, paid_amount, remaining_balance, remarks, payment_date)
      VALUES (
        p_student_id,
        v_final_fee,
        CASE WHEN v_is_paid THEN v_final_fee ELSE 0 END,
        CASE WHEN v_is_paid THEN 0 ELSE v_final_fee END,
        'Auto-generated from approved admission agreement',
        now()
      )
      ON CONFLICT DO NOTHING;

      -- If not paid, also generate a fee payment record in fee_payments
      IF NOT v_is_paid THEN
        INSERT INTO public.fee_payments (student_id, amount, due_date, status)
        VALUES (p_student_id, v_final_fee, (CURRENT_DATE + INTERVAL '10 days')::date, 'unpaid')
        ON CONFLICT DO NOTHING;
      END IF;
    END;
  END IF;

  -- Send welcome notifications to the student
  INSERT INTO public.notifications (user_id, role, notification_type, title, message, read)
  VALUES (
    p_student_id,
    'student',
    'payment_approved',
    'Account Approved!',
    'Your student account has been approved. Welcome to the institution! You now have full access to your student dashboard.',
    false
  );

  -- Send notification to the teacher if assigned
  IF v_teacher_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, role, notification_type, title, message, read)
    VALUES (
      v_teacher_id,
      'teacher',
      'interview_completed',
      'New Student Assigned',
      'A new student, ' || v_name || ', has been admitted and assigned to your class: ' || COALESCE(v_class, 'N/A') || '.',
      false
    );
  END IF;

  RETURN true;
END;
$$;

-- 7. RLS Policies Updates: ensure student can view their own admission deal and other data
DROP POLICY IF EXISTS "Students read own admission deals" ON public.admission_deals;
CREATE POLICY "Students read own admission deals" ON public.admission_deals
  FOR SELECT TO authenticated
  USING (student_email = auth.email() OR student_id = auth.uid());
