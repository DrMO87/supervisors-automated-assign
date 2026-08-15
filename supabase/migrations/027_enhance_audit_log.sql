-- Migration 027: Enhance Audit Log with User Identity, Date-Time, and Summaries

BEGIN;

-- 1. Add user identity & summary columns to audit_log table
ALTER TABLE public.audit_log 
ADD COLUMN IF NOT EXISTS changed_by_email VARCHAR(150),
ADD COLUMN IF NOT EXISTS user_role VARCHAR(50),
ADD COLUMN IF NOT EXISTS summary TEXT;

-- 2. Create index for fast date & user queries
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(changed_by_email);

-- 3. Enable RLS and policies
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.audit_log;
DROP POLICY IF EXISTS "Allow public insert" ON public.audit_log;

CREATE POLICY "Allow public read access" ON public.audit_log FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.audit_log FOR INSERT WITH CHECK (true);

-- 4. Automatic trigger function to log table modifications
CREATE OR REPLACE FUNCTION public.tr_auto_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    current_user_email text;
    summary_text text;
    rec_id uuid;
BEGIN
    -- Extract email from JWT session claims if available
    BEGIN
        current_user_email := current_setting('request.jwt.claims', true)::json->>'email';
    EXCEPTION WHEN OTHERS THEN
        current_user_email := NULL;
    END;

    IF current_user_email IS NULL OR current_user_email = '' THEN
        current_user_email := 'melkhodary@horus.edu.eg';
    END IF;

    IF (TG_OP = 'INSERT') THEN
        rec_id := NEW.id;
        summary_text := 'Created new record in ' || TG_TABLE_NAME;
    ELSIF (TG_OP = 'UPDATE') THEN
        rec_id := NEW.id;
        summary_text := 'Updated record in ' || TG_TABLE_NAME;
    ELSIF (TG_OP = 'DELETE') THEN
        rec_id := OLD.id;
        summary_text := 'Deleted record from ' || TG_TABLE_NAME;
    END IF;

    INSERT INTO public.audit_log (table_name, record_id, action, old_values, new_values, changed_by_email, user_role, summary)
    VALUES (
        TG_TABLE_NAME,
        rec_id,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        current_user_email,
        CASE WHEN current_user_email LIKE '%melkhodary%' THEN 'Super Admin' ELSE 'Head of Department' END,
        summary_text
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach triggers to core tables
DROP TRIGGER IF EXISTS tr_audit_exam_periods ON public.exam_periods;
CREATE TRIGGER tr_audit_exam_periods
AFTER INSERT OR UPDATE OR DELETE ON public.exam_periods
FOR EACH ROW EXECUTE FUNCTION public.tr_auto_audit_log();

DROP TRIGGER IF EXISTS tr_audit_assignments ON public.assignments;
CREATE TRIGGER tr_audit_assignments
AFTER INSERT OR UPDATE OR DELETE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.tr_auto_audit_log();

DROP TRIGGER IF EXISTS tr_audit_exam_sessions ON public.exam_sessions;
CREATE TRIGGER tr_audit_exam_sessions
AFTER INSERT OR UPDATE OR DELETE ON public.exam_sessions
FOR EACH ROW EXECUTE FUNCTION public.tr_auto_audit_log();

DROP TRIGGER IF EXISTS tr_audit_staff ON public.staff;
CREATE TRIGGER tr_audit_staff
AFTER INSERT OR UPDATE OR DELETE ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.tr_auto_audit_log();

DROP TRIGGER IF EXISTS tr_audit_rooms ON public.rooms;
CREATE TRIGGER tr_audit_rooms
AFTER INSERT OR UPDATE OR DELETE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.tr_auto_audit_log();

COMMIT;
