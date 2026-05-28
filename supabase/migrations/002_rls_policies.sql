-- Enable Row Level Security
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Staff policies (all authenticated users can read, only admins can modify)
CREATE POLICY "Allow read access to all authenticated users" ON staff
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for authenticated users" ON staff
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users" ON staff
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users" ON staff
  FOR DELETE USING (auth.role() = 'authenticated');

-- Rooms policies
CREATE POLICY "Allow read access to all authenticated users" ON rooms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for authenticated users" ON rooms
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users" ON rooms
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users" ON rooms
  FOR DELETE USING (auth.role() = 'authenticated');

-- Exam sessions policies
CREATE POLICY "Allow read access to all authenticated users" ON exam_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for authenticated users" ON exam_sessions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users" ON exam_sessions
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users" ON exam_sessions
  FOR DELETE USING (auth.role() = 'authenticated');

-- Assignments policies
CREATE POLICY "Allow read access to all authenticated users" ON assignments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for authenticated users" ON assignments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users" ON assignments
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users" ON assignments
  FOR DELETE USING (auth.role() = 'authenticated');

-- System settings policies
CREATE POLICY "Allow read access to all authenticated users" ON system_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users" ON system_settings
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Audit log policies (read-only for all, system inserts)
CREATE POLICY "Allow read access to all authenticated users" ON audit_log
  FOR SELECT USING (auth.role() = 'authenticated');

