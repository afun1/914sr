-- Supabase SQL Script to automatically create profiles for new auth users
-- Run this in your Supabase SQL Editor

-- Create a function to handle new user signup
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
    COALESCE(
      TRIM(
        COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || 
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
      ),
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NEW.email
    ),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run the function when a user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Create policy to allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create policy to allow profile creation (for the trigger)
CREATE POLICY "Enable insert for service role" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- Optional: Create profiles for existing auth users who don't have profiles yet
INSERT INTO public.profiles (id, email, display_name, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(
    TRIM(
      COALESCE(au.raw_user_meta_data->>'first_name', '') || ' ' || 
      COALESCE(au.raw_user_meta_data->>'last_name', '')
    ),
    COALESCE(au.raw_user_meta_data->>'full_name', ''),
    au.email
  ),
  au.created_at,
  au.updated_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;