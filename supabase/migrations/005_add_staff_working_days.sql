-- Add working_days column to staff table
-- Default to all weekdays (Sun-Thu) or Sat-Thu depending on region, let's assume Sat-Thu context from user request
ALTER TABLE public.staff 
ADD COLUMN working_days text[] DEFAULT ARRAY['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

-- Update existing rows to have default working days
UPDATE public.staff 
SET working_days = ARRAY['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
WHERE working_days IS NULL;
