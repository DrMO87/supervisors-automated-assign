-- Migration 030: Add allowed_buildings to staff for medical condition customization
-- Run this in Supabase SQL Editor if you wish to store these columns natively in PostgreSQL.
-- The application also automatically persists these settings in system_settings (staff_allowed_buildings) if the column is not yet present.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS allowed_buildings text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.staff.allowed_buildings IS
  'Specific campus building codes (e.g. M, P, S, F, E, A, B) that staff with medical conditions can be assigned to.';

NOTIFY pgrst, 'reload schema';
