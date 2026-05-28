-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Staff table with comprehensive tracking
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  job_title VARCHAR(10) NOT NULL CHECK (job_title IN ('Ch', 'D', 'TA')),
  current_score INTEGER DEFAULT 0,
  employment_status VARCHAR(20) NOT NULL CHECK (employment_status IN ('Full-time', 'Part-time')),
  availability_status VARCHAR(20) DEFAULT 'Available' CHECK (availability_status IN ('Available', 'On-Leave', 'Unavailable')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rooms with capacity constraints
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name VARCHAR(50) NOT NULL UNIQUE,
  max_capacity INTEGER NOT NULL CHECK (max_capacity > 0),
  building VARCHAR(50),
  floor INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exam sessions with detailed scheduling
CREATE TABLE exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_name VARCHAR(100) NOT NULL,
  subject_code VARCHAR(20),
  exam_date DATE NOT NULL,
  period INTEGER NOT NULL CHECK (period IN (1, 2)),
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  student_count INTEGER NOT NULL CHECK (student_count > 0),
  room_id UUID NOT NULL REFERENCES rooms(id),
  academic_year VARCHAR(20),
  semester VARCHAR(20),
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignment tracking with roles
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id),
  role VARCHAR(20) NOT NULL CHECK (role IN ('Head_Supervisor', 'Assistant')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID,
  is_manual_override BOOLEAN DEFAULT false,
  UNIQUE(exam_session_id, staff_id)
);

-- System configuration
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(50) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log for tracking changes
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(50) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_staff_availability ON staff(availability_status);
CREATE INDEX idx_staff_score ON staff(current_score);
CREATE INDEX idx_exam_sessions_date ON exam_sessions(exam_date, period);
CREATE INDEX idx_assignments_session ON assignments(exam_session_id);
CREATE INDEX idx_assignments_staff ON assignments(staff_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_sessions_updated_at BEFORE UPDATE ON exam_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('staffing_ratios', '{
  "ranges": [
    {"min": 1, "max": 9, "head_supervisors": 1, "assistants": 0},
    {"min": 10, "max": 30, "head_supervisors": 1, "assistants": 1},
    {"min": 31, "max": 50, "head_supervisors": 1, "assistants": 2},
    {"min": 51, "max": 60, "head_supervisors": 1, "assistants": 3},
    {"min": 61, "max": 999, "head_supervisors": 1, "assistants": 4}
  ]
}'::jsonb, 'Student count thresholds and required staff'),
('working_hours', '{
  "period_1": {"start": "08:00", "end": "12:00"},
  "period_2": {"start": "13:00", "end": "17:00"}
}'::jsonb, 'Time definitions for exam periods'),
('locked_weeks', '[]'::jsonb, 'Array of finalized date ranges'),
('scheduling_constraints', '{
  "allow_consecutive_shifts": false,
  "part_time_period_2_allowed": false
}'::jsonb, 'Configuration for scheduling rules');

