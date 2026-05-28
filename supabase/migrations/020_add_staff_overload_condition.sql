-- Migration 020: Add is_overloaded and overload_percentage to staff
BEGIN;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS is_overloaded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overload_percentage INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_staff_is_overloaded ON public.staff(is_overloaded);

COMMENT ON COLUMN public.staff.is_overloaded IS 'Flag indicating if the staff member has the Overloaded condition';
COMMENT ON COLUMN public.staff.overload_percentage IS 'Percentage (0-100) of score decrease over exam period';

COMMIT;
