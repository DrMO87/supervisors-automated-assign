-- Migration 019: Add specific_off_dates to staff
-- Allows staff to have date-specific unavailability that overrides the
-- recurring working_days weekday pattern. Dates stored as ISO strings (YYYY-MM-DD).

BEGIN;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS specific_off_dates text[] NOT NULL DEFAULT '{}';

-- GIN index so that containment queries like
--   specific_off_dates @> ARRAY['2026-06-09']
-- are fast even with many staff rows.
CREATE INDEX IF NOT EXISTS idx_staff_specific_off_dates
  ON public.staff USING GIN (specific_off_dates);

-- Helpful comment
COMMENT ON COLUMN public.staff.specific_off_dates IS
  'ISO date strings (YYYY-MM-DD) on which this staff member is NOT available. '
  'Takes precedence over the recurring working_days weekday pattern during scheduling.';

COMMIT;
