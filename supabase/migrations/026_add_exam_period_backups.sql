-- Migration 026: Add Exam Period Weekly Backups Table and Policies

BEGIN;

CREATE TABLE IF NOT EXISTS public.exam_period_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID REFERENCES public.exam_periods(id) ON DELETE CASCADE,
    period_name VARCHAR(150) NOT NULL,
    week_start_date DATE NOT NULL,
    week_label VARCHAR(100) NOT NULL,                    -- e.g. "Week 1 (2026-09-05)"
    backup_name VARCHAR(200) NOT NULL,       -- e.g. "Auto End-of-Week 1 Snapshot"
    trigger_type VARCHAR(50) DEFAULT 'automatic',        -- 'automatic' or 'manual'
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_period_week_backup UNIQUE (period_id, week_start_date, trigger_type)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_period_backups_period ON public.exam_period_backups(period_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.exam_period_backups ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Allow public read access" ON public.exam_period_backups;
DROP POLICY IF EXISTS "Allow public insert" ON public.exam_period_backups;
DROP POLICY IF EXISTS "Allow public update" ON public.exam_period_backups;
DROP POLICY IF EXISTS "Allow public delete" ON public.exam_period_backups;

CREATE POLICY "Allow public read access" ON public.exam_period_backups FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.exam_period_backups FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.exam_period_backups FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.exam_period_backups FOR DELETE USING (true);

COMMIT;
