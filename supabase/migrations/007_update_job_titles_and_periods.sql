-- Allow new job titles and more periods

-- 1. Update Staff Job Titles
-- First drop any existing check constraint if likely to exist (Supabase text columns usually don't have them unless manually added, but good to be safe)
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_job_title_check;

-- Update existing data
UPDATE staff SET job_title = 'Chemist' WHERE job_title = 'Ch';
UPDATE staff SET job_title = 'Demonstrator' WHERE job_title = 'D';
UPDATE staff SET job_title = 'Teaching Assistant' WHERE job_title = 'TA';

-- Add new constraint
ALTER TABLE staff ADD CONSTRAINT staff_job_title_check 
  CHECK (job_title IN ('Chemist', 'Demonstrator', 'Teaching Assistant'));

-- 2. Update Exam Sessions Periods
-- Remove constraint on period if it exists (assuming it was checked to be 1 or 2)
ALTER TABLE exam_sessions DROP CONSTRAINT IF EXISTS exam_sessions_period_check;

-- Add new constraint (e.g. 1 to 30) or just leave it as integer > 0
ALTER TABLE exam_sessions ADD CONSTRAINT exam_sessions_period_check
  CHECK (period > 0);
