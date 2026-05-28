-- Migration to ensure that deleting a room also deletes its exam sessions.
-- This enables the "Reset All Data" for rooms to work correctly.

BEGIN;

-- 1. Drop the existing foreign key constraint if it exists
ALTER TABLE public.exam_sessions
DROP CONSTRAINT IF EXISTS exam_sessions_room_id_fkey;

-- 2. Re-add the constraint with ON DELETE CASCADE
ALTER TABLE public.exam_sessions
ADD CONSTRAINT exam_sessions_room_id_fkey 
FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;

-- 3. Fix assignments foreign key for staff
ALTER TABLE public.assignments
DROP CONSTRAINT IF EXISTS assignments_staff_id_fkey;

ALTER TABLE public.assignments
ADD CONSTRAINT assignments_staff_id_fkey
FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

COMMIT;
