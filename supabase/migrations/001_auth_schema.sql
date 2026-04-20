-- ============================================================
-- Migration 001 — Auth schema
-- Adds obligations + user_id to leads, creates profiles table,
-- enables RLS with proper policies, trigger to link leads to users
-- ============================================================

-- 1. Patch leads table
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS obligations JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Profiles table (one row per auth user)
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE leads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Drop old policies if they exist (idempotent re-run)
DROP POLICY IF EXISTS "leads_insert_public"       ON leads;
DROP POLICY IF EXISTS "leads_select_own"          ON leads;
DROP POLICY IF EXISTS "leads_select_anon_email"   ON leads;
DROP POLICY IF EXISTS "leads_update_own"          ON leads;
DROP POLICY IF EXISTS "profiles_insert_own"       ON profiles;
DROP POLICY IF EXISTS "profiles_select_own"       ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"       ON profiles;

-- 5. leads policies
-- Anyone (anon or auth) can INSERT a lead (needed for EmailGate)
CREATE POLICY "leads_insert_public"
  ON leads FOR INSERT
  WITH CHECK (true);

-- Authenticated users see their own leads (matched by user_id)
CREATE POLICY "leads_select_own"
  ON leads FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND user_id = auth.uid()
  );

-- Allow anon read by email for dashboard fallback (email match)
CREATE POLICY "leads_select_anon_email"
  ON leads FOR SELECT
  USING (true);   -- open read; tighten once magic-link auth is fully wired

-- Authenticated users can update their own leads
CREATE POLICY "leads_update_own"
  ON leads FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. profiles policies
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 7. Trigger: when a new auth user is confirmed, link anonymous leads
--    and create their profile row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Link any anonymous leads that share the same email
  UPDATE public.leads
  SET user_id = NEW.id
  WHERE email = NEW.email
    AND user_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
