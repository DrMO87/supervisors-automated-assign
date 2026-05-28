-- COMPREHENSIVE FIX FOR STAFF JOB TITLES
-- Run this entire script to fix "value too long" and "invalid check constraint" errors.

-- 1. Remove the restrictive check constraint (so we can change values)
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_job_title_check;

-- 2. Change column type from VARCHAR(10) to TEXT (fixes "value too long" error)
ALTER TABLE staff ALTER COLUMN job_title TYPE TEXT;

-- 3. Update any existing data to match new format
UPDATE staff SET job_title = 'Chemist' WHERE job_title = 'Ch' OR job_title = 'C';
UPDATE staff SET job_title = 'Demonstrator' WHERE job_title = 'D';
UPDATE staff SET job_title = 'Teaching Assistant' WHERE job_title = 'TA';

-- 4. Add the new constraint with correct full titles
ALTER TABLE staff ADD CONSTRAINT staff_job_title_check 
  CHECK (job_title IN ('Chemist', 'Demonstrator', 'Teaching Assistant'));
