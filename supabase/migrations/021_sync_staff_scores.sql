-- Trigger to keep staff.current_score in sync with assignments table automatically by periods (distinct date + start time)
-- Run this in your Supabase SQL Editor.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_staff_score_on_assignment_change()
RETURNS TRIGGER AS $$
DECLARE
    target_staff_id uuid;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        target_staff_id := NEW.staff_id;
    ELSIF (TG_OP = 'DELETE') THEN
        target_staff_id := OLD.staff_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        target_staff_id := NEW.staff_id;
    END IF;

    -- Recalculate for OLD staff member if staff_id changed
    IF (TG_OP = 'UPDATE' AND OLD.staff_id IS DISTINCT FROM NEW.staff_id) THEN
        UPDATE public.staff s
        SET current_score = COALESCE((
            SELECT COUNT(DISTINCT (es.exam_date, es.start_time))
            FROM public.assignments a
            JOIN public.exam_sessions es ON a.exam_session_id = es.id
            WHERE a.staff_id = OLD.staff_id
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
    ), 0)
    WHERE s.id = target_staff_id;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_staff_score ON public.assignments;
CREATE TRIGGER tr_sync_staff_score
AFTER INSERT OR UPDATE OR DELETE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_staff_score_on_assignment_change();

COMMIT;
