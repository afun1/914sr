-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('user', 'manager', 'supervisor', 'admin');

-- Add role column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN role user_role DEFAULT 'user';

-- Update the handle_new_user function to include role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
        NEW.email,
        'user'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has admin panel access
CREATE OR REPLACE FUNCTION public.has_admin_access(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role user_role;
BEGIN
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = user_id;
    
    RETURN user_role IN ('manager', 'supervisor', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role user_role;
BEGIN
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = user_id;
    
    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role AS $$
DECLARE
    user_role user_role;
BEGIN
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = user_id;
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add policy for role management (only admins can change roles)
CREATE POLICY "Only admins can update roles" ON public.profiles
    FOR UPDATE 
    USING (
        auth.uid() = id OR 
        public.is_admin(auth.uid())
    )
    WITH CHECK (
        auth.uid() = id OR 
        public.is_admin(auth.uid())
    );
