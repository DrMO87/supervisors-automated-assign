-- Ensure working_days is an array type and can handle values
-- This file acts as a correctness check or "fix" script if the user runs it.

DO $$
BEGIN
    -- Check if column exists, if not add it (idempotent check)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'working_days') THEN
        ALTER TABLE staff ADD COLUMN working_days text[] DEFAULT '{}';
    END IF;

    -- Update any NULLs to empty array if strictly required, 
    -- though NULL usually means "Any" in our app logic.
    -- Un-comment if you strictly want empty array:
    -- UPDATE staff SET working_days = '{}' WHERE working_days IS NULL;
    
END $$;
