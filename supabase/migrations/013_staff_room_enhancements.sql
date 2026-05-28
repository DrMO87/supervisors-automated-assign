-- ========================================================
-- Migration 013: Staff & Room Feature Enhancements
-- ========================================================

-- 1. Feeding Mother support on Staff
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS is_feeding_mother BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS feeding_mother_days INTEGER DEFAULT 0
  -- 0 = not applicable
  -- 2 = allowed to leave 2 hours early (FT: 1 day/2h or 2 days/1h, PT: 1 day/2h)
  -- feeding_days_used tracked at runtime via scheduling constraints
;

-- 2. Health Issue flag on Staff
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS has_health_issue BOOLEAN DEFAULT false;
-- Staff with this flag should be preferred for rooms in M or P buildings

-- 3. Staff Supervision Role
-- Replaces the narrow 'Head_Supervisor' | 'Assistant' distinction at the staff profile level
-- This represents what role they CAN serve, not the assignment role
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS supervision_role VARCHAR(30) DEFAULT 'Invigilator'
  CHECK (supervision_role IN ('Invigilator', 'Committees Supervisor', 'Exam Supervisor'));

-- 4. Update assignments table to support new roles
ALTER TABLE assignments
  DROP CONSTRAINT IF EXISTS assignments_role_check;

ALTER TABLE assignments
  ADD CONSTRAINT assignments_role_check
  CHECK (role IN ('Head_Supervisor', 'Assistant', 'Committees_Supervisor', 'Exam_Supervisor', 'Invigilator'));

-- 5. Add parsed room fields to rooms for easy querying
-- building_code = first character of room_name (e.g. M, P, A, B)
-- floor_number  = second character of room_name
-- room_number   = 3rd+4th characters of room_name
-- is_near_pharmacy = true if building_code IN ('M','P')
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS building_code VARCHAR(5) GENERATED ALWAYS AS (UPPER(LEFT(room_name, 1))) STORED,
  ADD COLUMN IF NOT EXISTS is_near_pharmacy BOOLEAN GENERATED ALWAYS AS (UPPER(LEFT(room_name, 1)) IN ('M','P')) STORED;

-- Index for fast pharmacy-proximity queries
CREATE INDEX IF NOT EXISTS idx_rooms_near_pharmacy ON rooms(is_near_pharmacy);
CREATE INDEX IF NOT EXISTS idx_staff_health ON staff(has_health_issue);
CREATE INDEX IF NOT EXISTS idx_staff_feeding ON staff(is_feeding_mother);
