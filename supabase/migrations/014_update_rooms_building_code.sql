-- Update rooms table parsed columns
ALTER TABLE rooms DROP COLUMN IF EXISTS building_code;
ALTER TABLE rooms DROP COLUMN IF EXISTS is_near_pharmacy;

ALTER TABLE rooms
  ADD COLUMN building_code VARCHAR(5) GENERATED ALWAYS AS (
    CASE 
      WHEN REPLACE(LOWER(room_name), ' ', '') LIKE 'computerlabm1%' THEN 'M1'
      WHEN REPLACE(LOWER(room_name), ' ', '') LIKE 'computerlabm2%' THEN 'M2'
      WHEN REPLACE(LOWER(room_name), ' ', '') LIKE 'computerlab%' THEN UPPER(SUBSTRING(REPLACE(LOWER(room_name), ' ', '') FROM 12 FOR 1))
      WHEN REPLACE(LOWER(room_name), ' ', '') LIKE 'm1%' THEN 'M1'
      WHEN REPLACE(LOWER(room_name), ' ', '') LIKE 'm2%' THEN 'M2'
      ELSE UPPER(LEFT(LTRIM(room_name), 1))
    END
  ) STORED,
  ADD COLUMN is_near_pharmacy BOOLEAN GENERATED ALWAYS AS (
    CASE 
      WHEN REPLACE(LOWER(room_name), ' ', '') LIKE 'computerlabm%' THEN true
      WHEN REPLACE(LOWER(room_name), ' ', '') LIKE 'computerlabp%' THEN true
      WHEN LOWER(LTRIM(room_name)) LIKE 'm%' THEN true
      WHEN LOWER(LTRIM(room_name)) LIKE 'p%' THEN true
      ELSE false
    END
  ) STORED;
