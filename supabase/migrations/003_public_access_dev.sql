-- ============================================================
-- PUBLIC ACCESS POLICIES FOR DEVELOPMENT
-- ============================================================
-- This migration adds public access policies for development.
-- In production, you should use authentication and the policies
-- in 002_rls_policies.sql instead.
-- ============================================================

-- Drop existing restrictive policies (they require authentication)
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON staff;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON staff;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON staff;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON staff;

DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON rooms;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON rooms;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON rooms;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON rooms;

DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON exam_sessions;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON exam_sessions;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON exam_sessions;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON exam_sessions;

DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON assignments;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON assignments;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON assignments;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON assignments;

DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON system_settings;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON system_settings;

DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON audit_log;

-- ============================================================
-- CREATE PUBLIC ACCESS POLICIES
-- ============================================================

-- Staff table - full public access
CREATE POLICY "Allow public read access" ON staff
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON staff
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON staff
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete" ON staff
  FOR DELETE USING (true);

-- Rooms table - full public access
CREATE POLICY "Allow public read access" ON rooms
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON rooms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON rooms
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete" ON rooms
  FOR DELETE USING (true);

-- Exam sessions table - full public access
CREATE POLICY "Allow public read access" ON exam_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON exam_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON exam_sessions
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete" ON exam_sessions
  FOR DELETE USING (true);

-- Assignments table - full public access
CREATE POLICY "Allow public read access" ON assignments
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON assignments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON assignments
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete" ON assignments
  FOR DELETE USING (true);

-- System settings table - full public access
CREATE POLICY "Allow public read access" ON system_settings
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON system_settings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON system_settings
  FOR UPDATE USING (true);

-- Audit log table - read-only public access
CREATE POLICY "Allow public read access" ON audit_log
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON audit_log
  FOR INSERT WITH CHECK (true);

