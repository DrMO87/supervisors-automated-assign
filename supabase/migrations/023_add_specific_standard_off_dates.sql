-- Add specific_standard_off_dates column to track standard off days per specific date
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS specific_standard_off_dates text[] DEFAULT '{}'::text[];

-- Update the schema cache
NOTIFY pgrst, 'reload schema';
