-- FORCE RESET Permissions for System Settings
-- This script fixes the "new row violates row-level security policy" error.

BEGIN;

-- 1. Ensure RLS is enabled (standard) or disabled (if you accept that)
-- We will ENABLE it but add a policy that allows EVERYTHING.
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 2. Drop potential blocking policies (Cleanup old ones)
DROP POLICY IF EXISTS "Allow public read access" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public insert" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public update" ON public.system_settings;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.system_settings;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.system_settings;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.system_settings;
DROP POLICY IF EXISTS "Enable update for all users" ON public.system_settings;
DROP POLICY IF EXISTS "Allow all actions" ON public.system_settings;

-- 3. Create ONE policy allowing ALL actions (Select, Insert, Update, Delete)
CREATE POLICY "Allow all actions" ON public.system_settings
FOR ALL
USING (true)
WITH CHECK (true);

COMMIT;
