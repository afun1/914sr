-- Add assignment fields to profiles table for the assignment system
ALTER TABLE public.profiles 
ADD COLUMN assigned_to_admin UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN assigned_to_supervisor UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN assigned_to_manager UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create indexes for better performance on assignment queries
CREATE INDEX idx_profiles_assigned_to_admin ON public.profiles(assigned_to_admin) WHERE assigned_to_admin IS NOT NULL;
CREATE INDEX idx_profiles_assigned_to_supervisor ON public.profiles(assigned_to_supervisor) WHERE assigned_to_supervisor IS NOT NULL;
CREATE INDEX idx_profiles_assigned_to_manager ON public.profiles(assigned_to_manager) WHERE assigned_to_manager IS NOT NULL;
CREATE INDEX idx_profiles_assigned_by ON public.profiles(assigned_by) WHERE assigned_by IS NOT NULL;

-- Update RLS policies to allow assignment operations
-- Allow users to view assignments involving them
CREATE POLICY "Users can view assignments" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR 
        auth.uid() = assigned_to_admin OR 
        auth.uid() = assigned_to_supervisor OR 
        auth.uid() = assigned_to_manager OR
        auth.uid() = assigned_by OR
        public.has_admin_access(auth.uid())
    );

-- Allow authorized users to create/update assignments
CREATE POLICY "Authorized users can manage assignments" ON public.profiles
    FOR UPDATE USING (
        public.has_admin_access(auth.uid()) OR
        auth.uid() = assigned_to_admin OR 
        auth.uid() = assigned_to_supervisor OR 
        auth.uid() = assigned_to_manager
    );

-- Function to check assignment permissions
CREATE OR REPLACE FUNCTION public.can_assign_user(assignor_id UUID, assignee_role user_role)
RETURNS BOOLEAN AS $$
DECLARE
    assignor_role user_role;
BEGIN
    SELECT role INTO assignor_role 
    FROM public.profiles 
    WHERE id = assignor_id;
    
    -- Admins can assign anyone
    IF assignor_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Supervisors can assign managers and users
    IF assignor_role = 'supervisor' AND assignee_role IN ('manager', 'user') THEN
        RETURN TRUE;
    END IF;
    
    -- Managers can assign users
    IF assignor_role = 'manager' AND assignee_role = 'user' THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
