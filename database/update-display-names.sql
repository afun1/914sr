-- SQL Script to Update Display Names from First and Last Names
-- Run this in your CORRECT Supabase project's SQL Editor

-- Update all profiles to set display_name from first_name and last_name
UPDATE public.profiles 
SET display_name = CASE 
    -- If both first_name and last_name exist, combine with space
    WHEN TRIM(COALESCE(first_name, '')) != '' AND TRIM(COALESCE(last_name, '')) != '' 
    THEN TRIM(first_name || ' ' || last_name)
    
    -- If only first_name exists, use that
    WHEN TRIM(COALESCE(first_name, '')) != '' AND TRIM(COALESCE(last_name, '')) = ''
    THEN TRIM(first_name)
    
    -- If only last_name exists, use that
    WHEN TRIM(COALESCE(first_name, '')) = '' AND TRIM(COALESCE(last_name, '')) != ''
    THEN TRIM(last_name)
    
    -- If neither exists, use email as fallback
    ELSE email
END,
updated_at = NOW()
WHERE display_name IS NULL OR display_name = '' OR display_name = email;

-- Also update the trigger function to handle future signups better
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    display_name,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    -- Better display_name logic
    CASE 
        WHEN TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '')) != '' 
         AND TRIM(COALESCE(NEW.raw_user_meta_data->>'last_name', '')) != ''
        THEN TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'last_name', ''))
        
        WHEN TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '')) != ''
        THEN TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', ''))
        
        WHEN TRIM(COALESCE(NEW.raw_user_meta_data->>'last_name', '')) != ''
        THEN TRIM(COALESCE(NEW.raw_user_meta_data->>'last_name', ''))
        
        WHEN TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')) != ''
        THEN TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
        
        ELSE NEW.email
    END,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the results
SELECT 
  id,
  email,
  first_name,
  last_name,
  display_name,
  CASE 
    WHEN display_name IS NULL OR display_name = '' THEN '❌ Empty'
    WHEN display_name = email THEN '⚠️ Using Email'  
    ELSE '✅ Good'
  END as status
FROM public.profiles 
ORDER BY 
  CASE 
    WHEN display_name IS NULL OR display_name = '' THEN 1
    WHEN display_name = email THEN 2
    ELSE 3
  END,
  created_at DESC
LIMIT 20;