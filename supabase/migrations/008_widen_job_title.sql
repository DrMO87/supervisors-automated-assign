-- Widen job_title column to support longer titles like 'Teaching Assistant'
-- Previously it was VARCHAR(10), which is too short.

ALTER TABLE staff ALTER COLUMN job_title TYPE TEXT;
