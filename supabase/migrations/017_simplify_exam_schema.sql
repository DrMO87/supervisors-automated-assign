-- Migration to simplify the exam_sessions schema based on user request.
-- This script removes: subject_code, period, duration_minutes, academic_year, semester.

BEGIN;

-- 1. Drop the columns from exam_sessions
ALTER TABLE public.exam_sessions 
DROP COLUMN IF EXISTS subject_code,
DROP COLUMN IF EXISTS period,
DROP COLUMN IF EXISTS duration_minutes,
DROP COLUMN IF EXISTS academic_year,
DROP COLUMN IF EXISTS semester;

-- 2. Update indexes that used 'period'
DROP INDEX IF EXISTS idx_exam_sessions_date;
CREATE INDEX idx_exam_sessions_date ON public.exam_sessions(exam_date, start_time);

COMMIT;
