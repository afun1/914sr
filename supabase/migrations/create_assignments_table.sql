-- Create assignments/hierarchy table for user management
-- This table stores who is assigned to whom (users -> managers -> supervisors -> admin)

CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignee_role user_role NOT NULL,
  assignor_role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure logical hierarchy (users -> managers -> supervisors -> admin)
  CONSTRAINT valid_assignment CHECK (
    (assignee_role = 'user' AND assignor_role = 'manager') OR
    (assignee_role = 'manager' AND assignor_role = 'supervisor') OR
    (assignee_role = 'supervisor' AND assignor_role = 'admin')
  ),
  
  -- Prevent duplicate assignments (one person can only be assigned to one manager)
  UNIQUE(assignee_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_assignments_assignee ON assignments(assignee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assignor ON assignments(assignor_id);
CREATE INDEX IF NOT EXISTS idx_assignments_roles ON assignments(assignee_role, assignor_role);

-- Enable RLS (Row Level Security)
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Control who can see/edit assignments
CREATE POLICY "Users can view their own assignments" ON assignments
  FOR SELECT USING (
    assignee_id = auth.uid() OR assignor_id = auth.uid()
  );

CREATE POLICY "Admins can manage all assignments" ON assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Supervisors can manage their hierarchy" ON assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('supervisor', 'admin')
    )
  );

CREATE POLICY "Managers can view their assignments" ON assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('manager', 'supervisor', 'admin')
    )
  );

-- Update trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_assignments_updated_at();