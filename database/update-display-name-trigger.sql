-- Supabase SQL Script to handle display_name from first and last names
-- Run this in your Supabase SQL Editor

-- First, add display_name column to profiles table if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Create a function to update display_name from first_name and last_name
CREATE OR REPLACE FUNCTION update_display_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Combine first_name and last_name into display_name
  IF NEW.first_name IS NOT NULL AND NEW.last_name IS NOT NULL THEN
    NEW.display_name := TRIM(NEW.first_name || ' ' || NEW.last_name);
  ELSIF NEW.first_name IS NOT NULL THEN
    NEW.display_name := NEW.first_name;
  ELSIF NEW.last_name IS NOT NULL THEN
    NEW.display_name := NEW.last_name;
  ELSE
    NEW.display_name := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update display_name on INSERT or UPDATE
DROP TRIGGER IF EXISTS trigger_update_display_name ON profiles;
CREATE TRIGGER trigger_update_display_name
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_display_name();

-- Update existing records to populate display_name
UPDATE profiles 
SET display_name = CASE 
  WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN 
    TRIM(first_name || ' ' || last_name)
  WHEN first_name IS NOT NULL THEN 
    first_name
  WHEN last_name IS NOT NULL THEN 
    last_name
  ELSE 
    NULL
END
WHERE display_name IS NULL;

-- Optional: Create an index on display_name for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);