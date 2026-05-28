-- Add 'Lecturer' properly to the job_title database constraint
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_job_title_check;

ALTER TABLE staff ADD CONSTRAINT staff_job_title_check 
  CHECK (job_title IN ('Chemist', 'Demonstrator', 'Teaching Assistant', 'Lecturer'));
