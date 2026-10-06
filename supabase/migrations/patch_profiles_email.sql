-- Migration: Add email column to profiles and create pairing/linking tables
-- Run this in Supabase SQL Editor if you already ran full_schema.sql without email column
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT)

-- Step 1: Add email column if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email) WHERE email <> '';

-- Step 2: Backfill email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Step 3: Create/replace the new-user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'USER')
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Ensure caregiver_links has consented_at column (some older migrations used consentGrantedAt)
ALTER TABLE public.caregiver_links ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;
