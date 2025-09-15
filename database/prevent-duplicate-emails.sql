-- Additional SQL Script to prevent duplicate emails
-- Run this in your Supabase SQL Editor after the previous script

-- Add unique constraint on email column to prevent duplicates at database level
ALTER TABLE profiles 
ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- Create index on email for better performance (if not already exists)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Optional: Clean up any existing duplicate emails (run this carefully!)
-- This will keep the first occurrence of each email and remove duplicates
-- DELETE FROM profiles 
-- WHERE id NOT IN (
--   SELECT MIN(id) 
--   FROM profiles 
--   GROUP BY email
-- );

-- Note: Uncomment the DELETE statement above ONLY if you want to remove existing duplicates
-- Make sure to backup your data first!