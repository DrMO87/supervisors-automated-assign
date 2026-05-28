-- Increase the length of the 'role' column in assignments to accommodate exactly 'Committees_Supervisor' which is 21 chars

ALTER TABLE assignments
  ALTER COLUMN role TYPE VARCHAR(50);
