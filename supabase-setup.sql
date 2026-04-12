-- Run this in your Supabase SQL editor

CREATE TABLE members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  sobriety_date DATE,
  sponsor_dropdown TEXT,
  sponsor_other TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'nonbinary')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Allow public inserts (for the form)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert" ON members
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read" ON members
  FOR SELECT USING (true);

CREATE POLICY "Service role can do anything" ON members
  USING (auth.role() = 'service_role');
