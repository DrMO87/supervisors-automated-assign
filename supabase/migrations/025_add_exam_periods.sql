-- Migration 025: Add Exam Periods / Semester Management & Period-Aware Score Triggers

BEGIN;

-- 1. Create exam_periods table
CREATE TABLE IF NOT EXISTS public.exam_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,                        -- e.g. "Final Exams - Fall 2026"
    semester_type VARCHAR(50) NOT NULL,                -- Fall, Spring, Summer, Midterm, Final, Custom
    academic_year VARCHAR(20),                          -- e.g. "2025-2026"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    score_mode VARCHAR(20) DEFAULT 'fresh',            -- 'continue' or 'fresh'
    score_snapshot JSONB DEFAULT '[]'::jsonb,           -- snapshot of staff scores when period was deactivated
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_dates CHECK (end_date >= start_date)
);

-- Enable RLS
ALTER TABLE public.exam_periods ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Allow public read access" ON public.exam_periods;
DROP POLICY IF EXISTS "Allow public insert" ON public.exam_periods;
DROP POLICY IF EXISTS "Allow public update" ON public.exam_periods;
DROP POLICY IF EXISTS "Allow public delete" ON public.exam_periods;

CREATE POLICY "Allow public read access" ON public.exam_periods FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.exam_periods FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.exam_periods FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.exam_periods FOR DELETE USING (true);

-- 2. Update trigger function for staff.current_score to be period-aware
CREATE OR REPLACE FUNCTION public.sync_staff_score_on_assignment_change()
RETURNS TRIGGER AS $$
DECLARE
    target_staff_id uuid;
    active_start DATE;
    active_end DATE;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        target_staff_id := NEW.staff_id;
    ELSIF (TG_OP = 'DELETE') THEN
        target_staff_id := OLD.staff_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        target_staff_id := NEW.staff_id;
    END IF;

    -- Fetch active period date bounds
    SELECT start_date, end_date INTO active_start, active_end
    FROM public.exam_periods
    WHERE is_active = true
    LIMIT 1;

    -- Recalculate for OLD staff member if staff_id changed
    IF (TG_OP = 'UPDATE' AND OLD.staff_id IS DISTINCT FROM NEW.staff_id) THEN
        UPDATE public.staff s
        SET current_score = COALESCE((
            SELECT COUNT(DISTINCT (es.exam_date, es.start_time))
            FROM public.assignments a
            JOIN public.exam_sessions es ON a.exam_session_id = es.id
            WHERE a.staff_id = OLD.staff_id
              AND (active_start IS NULL OR (es.exam_date >= active_start AND es.exam_date <= active_end))
        ), 0)
        WHERE s.id = OLD.staff_id;
    END IF;

    -- Recalculate for target staff member
    UPDATE public.staff s
    SET current_score = COALESCE((
        SELECT COUNT(DISTINCT (es.exam_date, es.start_time))
        FROM public.assignments a
        JOIN public.exam_sessions es ON a.exam_session_id = es.id
        WHERE a.staff_id = target_staff_id
          AND (active_start IS NULL OR (es.exam_date >= active_start AND es.exam_date <= active_end))
    ), 0)
    WHERE s.id = target_staff_id;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update trigger function for staff.free_staff_score to be period-aware
CREATE OR REPLACE FUNCTION public.sync_staff_free_score_on_change()
RETURNS TRIGGER AS $$
DECLARE
    target_staff_id UUID;
    active_start DATE;
    active_end DATE;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        target_staff_id := NEW.staff_id;
    ELSIF (TG_OP = 'DELETE') THEN
        target_staff_id := OLD.staff_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        target_staff_id := NEW.staff_id;
    END IF;

    -- Fetch active period date bounds
    SELECT start_date, end_date INTO active_start, active_end
    FROM public.exam_periods
    WHERE is_active = true
    LIMIT 1;

    -- Recalculate for OLD staff member if staff_id changed during update
    IF (TG_OP = 'UPDATE' AND OLD.staff_id IS DISTINCT FROM NEW.staff_id) THEN
        UPDATE public.staff s
        SET free_staff_score = COALESCE((
            SELECT COUNT(*)
            FROM public.period_free_staff pfs
            WHERE pfs.staff_id = OLD.staff_id
              AND (active_start IS NULL OR (pfs.exam_date >= active_start AND pfs.exam_date <= active_end))
        ), 0)
        WHERE s.id = OLD.staff_id;
    END IF;

    -- Recalculate for target staff member
    UPDATE public.staff s
    SET free_staff_score = COALESCE((
        SELECT COUNT(*)
        FROM public.period_free_staff pfs
        WHERE pfs.staff_id = target_staff_id
          AND (active_start IS NULL OR (pfs.exam_date >= active_start AND pfs.exam_date <= active_end))
    ), 0)
    WHERE s.id = target_staff_id;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
