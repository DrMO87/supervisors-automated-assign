-- Migration 028: Add working days policy columns to exam_periods
-- Run this in Supabase SQL Editor if you wish to store these columns natively in PostgreSQL.
-- The application also automatically persists these settings in system_settings if the columns are not yet present.

ALTER TABLE public.exam_periods
ADD COLUMN IF NOT EXISTS ignore_staff_working_days BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_days_per_week INTEGER DEFAULT 3;
