-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_created_by ON folders(created_by);
CREATE INDEX IF NOT EXISTS idx_folders_is_active ON folders(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Users can see all folders (for admin purposes)
CREATE POLICY "Users can view all folders" ON folders FOR SELECT USING (true);

-- Only authenticated users can insert folders
CREATE POLICY "Authenticated users can create folders" ON folders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own folders or folders they created
CREATE POLICY "Users can update their folders" ON folders FOR UPDATE USING (
    user_id = auth.uid() OR created_by = auth.uid()
);

-- Users can delete their own folders or folders they created
CREATE POLICY "Users can delete their folders" ON folders FOR DELETE USING (
    user_id = auth.uid() OR created_by = auth.uid()
);

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();