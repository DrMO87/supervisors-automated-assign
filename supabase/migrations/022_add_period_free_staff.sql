-- Migration to add period_free_staff (reserve staff) and update staff scores automatically
-- Run this in your Supabase SQL Editor.

BEGIN;

-- 1. Add free_staff_score column to staff table if it doesn't exist
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS free_staff_score INTEGER DEFAULT 0 NOT NULL;

-- 2. Create period_free_staff table
CREATE TABLE IF NOT EXISTS public.period_free_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_date DATE NOT NULL,
    period INTEGER NOT NULL,
    start_time TIME NOT NULL,
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_period_free_staff UNIQUE (exam_date, period, staff_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_period_free_staff_date ON public.period_free_staff(exam_date, period);
CREATE INDEX IF NOT EXISTS idx_period_free_staff_staff ON public.period_free_staff(staff_id);

-- 3. Enable RLS on period_free_staff
ALTER TABLE public.period_free_staff ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access" ON public.period_free_staff;
DROP POLICY IF EXISTS "Allow public insert" ON public.period_free_staff;
DROP POLICY IF EXISTS "Allow public update" ON public.period_free_staff;
DROP POLICY IF EXISTS "Allow public delete" ON public.period_free_staff;

-- Create simple "Allow All" policies for development simplicity
CREATE POLICY "Allow public read access" ON public.period_free_staff FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.period_free_staff FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.period_free_staff FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.period_free_staff FOR DELETE USING (true);

-- 4. Create trigger function to keep staff.free_staff_score in sync with period_free_staff
CREATE OR REPLACE FUNCTION public.sync_staff_free_score_on_change()
RETURNS TRIGGER AS $$
DECLARE
    target_staff_id UUID;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        target_staff_id := NEW.staff_id;
    ELSIF (TG_OP = 'DELETE') THEN
        target_staff_id := OLD.staff_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        target_staff_id := NEW.staff_id;
    END IF;

    -- Recalculate for OLD staff member if staff_id changed during update
    IF (TG_OP = 'UPDATE' AND OLD.staff_id IS DISTINCT FROM NEW.staff_id) THEN
        UPDATE public.staff s
        SET free_staff_score = COALESCE((
            SELECT COUNT(*)
            FROM public.period_free_staff pfs
            WHERE pfs.staff_id = OLD.staff_id
        ), 0)
        WHERE s.id = OLD.staff_id;
    END IF;

    -- Recalculate for target staff member
    UPDATE public.staff s
    SET free_staff_score = COALESCE((
        SELECT COUNT(*)
        FROM public.period_free_staff pfs
        WHERE pfs.staff_id = target_staff_id
    ), 0)
    WHERE s.id = target_staff_id;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any and create new
DROP TRIGGER IF EXISTS tr_sync_staff_free_score ON public.period_free_staff;
CREATE TRIGGER tr_sync_staff_free_score
AFTER INSERT OR UPDATE OR DELETE ON public.period_free_staff
FOR EACH ROW EXECUTE FUNCTION public.sync_staff_free_score_on_change();

COMMIT;
