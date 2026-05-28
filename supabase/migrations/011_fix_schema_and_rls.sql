-- EMERGENCY FIX SCRIPT
-- Run this in your Supabase SQL Editor to fix "Error updating staff" and Settings issues.

BEGIN;

-- 1. Ensure 'working_days' column exists in 'staff' table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'working_days') THEN
        ALTER TABLE public.staff ADD COLUMN working_days text[] DEFAULT ARRAY['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    END IF;
END $$;

-- 2. RESET RLS POLICIES (Fix Permissions)
-- Allow Public/Anon access for development simplicity to prevent Empty Error {}

-- Enable RLS (Should be enabled generally)
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow all for generic" ON public.staff;
DROP POLICY IF EXISTS "Allow public read access" ON public.staff;
DROP POLICY IF EXISTS "Allow public insert" ON public.staff;
DROP POLICY IF EXISTS "Allow public update" ON public.staff;
DROP POLICY IF EXISTS "Allow public delete" ON public.staff;

DROP POLICY IF EXISTS "Allow public read access" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public insert" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public update" ON public.system_settings;

-- Re-create simple "Allow All" policies for Staff
CREATE POLICY "Allow public read access" ON public.staff FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.staff FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.staff FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.staff FOR DELETE USING (true);

-- Re-create simple "Allow All" policies for System Settings
CREATE POLICY "Allow public read access" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.system_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.system_settings FOR UPDATE USING (true);

-- Re-create simple "Allow All" policies for Assignments
DROP POLICY IF EXISTS "Allow public read access" ON public.assignments;
DROP POLICY IF EXISTS "Allow public insert" ON public.assignments;
DROP POLICY IF EXISTS "Allow public update" ON public.assignments;
DROP POLICY IF EXISTS "Allow public delete" ON public.assignments;

CREATE POLICY "Allow public read access" ON public.assignments FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.assignments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.assignments FOR DELETE USING (true);

-- Re-create simple "Allow All" policies for Exam Sessions
DROP POLICY IF EXISTS "Allow public read access" ON public.exam_sessions;
DROP POLICY IF EXISTS "Allow public insert" ON public.exam_sessions;
DROP POLICY IF EXISTS "Allow public update" ON public.exam_sessions;
DROP POLICY IF EXISTS "Allow public delete" ON public.exam_sessions;

CREATE POLICY "Allow public read access" ON public.exam_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.exam_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.exam_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.exam_sessions FOR DELETE USING (true);

COMMIT;
