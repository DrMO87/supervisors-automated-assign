-- Fix RLS policies for ALL tables to allow public access (for development)

-- 1. EXAM SESSIONS
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON exam_sessions;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON exam_sessions;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON exam_sessions;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON exam_sessions;

DROP POLICY IF EXISTS "Allow public read access" ON exam_sessions;
DROP POLICY IF EXISTS "Allow public insert" ON exam_sessions;
DROP POLICY IF EXISTS "Allow public update" ON exam_sessions;
DROP POLICY IF EXISTS "Allow public delete" ON exam_sessions;

CREATE POLICY "Allow public read access" ON exam_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON exam_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON exam_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON exam_sessions FOR DELETE USING (true);

-- 2. STAFF
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON staff;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON staff;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON staff;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON staff;

DROP POLICY IF EXISTS "Allow public read access" ON staff;
DROP POLICY IF EXISTS "Allow public insert" ON staff;
DROP POLICY IF EXISTS "Allow public update" ON staff;
DROP POLICY IF EXISTS "Allow public delete" ON staff;

CREATE POLICY "Allow public read access" ON staff FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON staff FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON staff FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON staff FOR DELETE USING (true);

-- 3. ASSIGNMENTS
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON assignments;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON assignments;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON assignments;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON assignments;

DROP POLICY IF EXISTS "Allow public read access" ON assignments;
DROP POLICY IF EXISTS "Allow public insert" ON assignments;
DROP POLICY IF EXISTS "Allow public update" ON assignments;
DROP POLICY IF EXISTS "Allow public delete" ON assignments;

CREATE POLICY "Allow public read access" ON assignments FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON assignments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON assignments FOR DELETE USING (true);

-- 4. SYSTEM SETTINGS
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON system_settings;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON system_settings;

DROP POLICY IF EXISTS "Allow public read access" ON system_settings;
DROP POLICY IF EXISTS "Allow public insert" ON system_settings;
DROP POLICY IF EXISTS "Allow public update" ON system_settings;

CREATE POLICY "Allow public read access" ON system_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON system_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON system_settings FOR UPDATE USING (true);

-- 5. AUDIT LOG (Optional, usually read-only)
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON audit_log;
DROP POLICY IF EXISTS "Allow public read access" ON audit_log;
DROP POLICY IF EXISTS "Allow public insert" ON audit_log;

CREATE POLICY "Allow public read access" ON audit_log FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON audit_log FOR INSERT WITH CHECK (true);
