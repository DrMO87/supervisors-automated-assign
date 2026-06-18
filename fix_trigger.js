require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const sql = `
BEGIN;

DROP TRIGGER IF EXISTS tr_sync_staff_score ON public.assignments;
DROP TRIGGER IF EXISTS tr_sync_staff_score_update ON public.assignments;
DROP TRIGGER IF EXISTS tr_sync_staff_score_insert ON public.assignments;
DROP TRIGGER IF EXISTS tr_sync_staff_score_delete ON public.assignments;

CREATE OR REPLACE FUNCTION public.sync_staff_score_update_stmt()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.staff s
    SET current_score = COALESCE((
        SELECT COUNT(DISTINCT (es.exam_date, es.start_time))
        FROM public.assignments a
        JOIN public.exam_sessions es ON a.exam_session_id = es.id
        WHERE a.staff_id = s.id
    ), 0)
    WHERE s.id IN (
        SELECT staff_id FROM old_table
        UNION
        SELECT staff_id FROM new_table
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_staff_score_insert_stmt()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.staff s
    SET current_score = COALESCE((
        SELECT COUNT(DISTINCT (es.exam_date, es.start_time))
        FROM public.assignments a
        JOIN public.exam_sessions es ON a.exam_session_id = es.id
        WHERE a.staff_id = s.id
    ), 0)
    WHERE s.id IN (SELECT staff_id FROM new_table);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_staff_score_delete_stmt()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.staff s
    SET current_score = COALESCE((
        SELECT COUNT(DISTINCT (es.exam_date, es.start_time))
        FROM public.assignments a
        JOIN public.exam_sessions es ON a.exam_session_id = es.id
        WHERE a.staff_id = s.id
    ), 0)
    WHERE s.id IN (SELECT staff_id FROM old_table);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_sync_staff_score_update
AFTER UPDATE ON public.assignments
REFERENCING OLD TABLE AS old_table NEW TABLE AS new_table
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_staff_score_update_stmt();

CREATE TRIGGER tr_sync_staff_score_insert
AFTER INSERT ON public.assignments
REFERENCING NEW TABLE AS new_table
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_staff_score_insert_stmt();

CREATE TRIGGER tr_sync_staff_score_delete
AFTER DELETE ON public.assignments
REFERENCING OLD TABLE AS old_table
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_staff_score_delete_stmt();

COMMIT;
  `;

  // We have to use rpc to execute raw SQL, but Supabase client doesn't expose it directly unless we have an RPC endpoint.
  // Wait, I can execute it using psql or I can just create a temporary table/function using migrations if I run migrations.
  console.log("SQL to execute:");
  console.log(sql);
}

main().catch(console.error);
