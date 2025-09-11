-- Update assignments table to allow flexible role assignments
-- Remove the rigid hierarchy constraint and add a more flexible one

-- First, drop the old constraint
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS valid_assignment;

-- Add new flexible constraint that prevents invalid assignments
ALTER TABLE assignments ADD CONSTRAINT flexible_assignment CHECK (
  (assignee_role = 'user' AND assignor_role IN ('manager', 'supervisor', 'admin')) OR
  (assignee_role = 'manager' AND assignor_role IN ('supervisor', 'admin')) OR
  (assignee_role = 'supervisor' AND assignor_role = 'admin')
);

-- Also add a constraint to prevent self-assignment
ALTER TABLE assignments ADD CONSTRAINT no_self_assignment CHECK (assignee_id != assignor_id);