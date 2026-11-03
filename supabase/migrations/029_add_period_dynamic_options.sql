-- Migration 029: Add dynamic period options to exam_periods
-- Run this in Supabase SQL Editor if you wish to store these columns natively in PostgreSQL.
-- The application also automatically persists these settings in system_settings (period_rules) if columns are not yet present.

ALTER TABLE public.exam_periods
ADD COLUMN IF NOT EXISTS availability_policy VARCHAR(50) DEFAULT 'respect_all_off_days',
ADD COLUMN IF NOT EXISTS oral_exam_assignment_mode VARCHAR(50) DEFAULT 'combined',
ADD COLUMN IF NOT EXISTS reserve_supervisors_target INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS reserve_assistants_target INTEGER DEFAULT 3;
