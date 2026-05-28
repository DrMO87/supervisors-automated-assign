-- Fix RLS policies for rooms table to allow public access (for development)

-- Drop any existing restrictive policies
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON rooms;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON rooms;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON rooms;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON rooms;

-- Drop any existing public policies to avoid duplicates before recreating
DROP POLICY IF EXISTS "Allow public read access" ON rooms;
DROP POLICY IF EXISTS "Allow public insert" ON rooms;
DROP POLICY IF EXISTS "Allow public update" ON rooms;
DROP POLICY IF EXISTS "Allow public delete" ON rooms;

-- Create permissive public policies
CREATE POLICY "Allow public read access" ON rooms
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON rooms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON rooms
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete" ON rooms
  FOR DELETE USING (true);
