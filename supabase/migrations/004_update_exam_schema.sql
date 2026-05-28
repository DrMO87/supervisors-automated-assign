-- Add new columns to exam_sessions table
ALTER TABLE exam_sessions
ADD COLUMN IF NOT EXISTS exam_type text,
ADD COLUMN IF NOT EXISTS end_time time,
ADD COLUMN IF NOT EXISTS student_start text,
ADD COLUMN IF NOT EXISTS student_end text;

COMMENT ON COLUMN exam_sessions.student_start IS 'Starting seat number or ID';
COMMENT ON COLUMN exam_sessions.student_end IS 'Ending seat number or ID';
