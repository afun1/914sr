-- Create videos table to store recording metadata with customer information
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    vimeo_uri TEXT, -- Vimeo video URI (e.g., "/videos/123456789")
    vimeo_id TEXT, -- Vimeo video ID
    vimeo_url TEXT, -- Public Vimeo URL
    duration INTEGER, -- Duration in seconds
    file_size BIGINT, -- File size in bytes
    
    -- User who created the recording
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Customer information
    customer_name TEXT,
    customer_email TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Create policies for the videos table
-- Users can view their own videos
CREATE POLICY "Users can view own videos" ON public.videos
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all videos
CREATE POLICY "Admins can view all videos" ON public.videos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'supervisor', 'manager')
        )
    );

-- Users can insert their own videos
CREATE POLICY "Users can insert own videos" ON public.videos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own videos
CREATE POLICY "Users can update own videos" ON public.videos
    FOR UPDATE USING (auth.uid() = user_id);

-- Admins can update all videos
CREATE POLICY "Admins can update all videos" ON public.videos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'supervisor')
        )
    );

-- Users can delete their own videos
CREATE POLICY "Users can delete own videos" ON public.videos
    FOR DELETE USING (auth.uid() = user_id);

-- Admins can delete all videos
CREATE POLICY "Admins can delete all videos" ON public.videos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at);
CREATE INDEX IF NOT EXISTS idx_videos_customer_email ON public.videos(customer_email);
CREATE INDEX IF NOT EXISTS idx_videos_vimeo_id ON public.videos(vimeo_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_videos_updated_at ON public.videos;
CREATE TRIGGER update_videos_updated_at
    BEFORE UPDATE ON public.videos
    FOR EACH ROW EXECUTE FUNCTION public.update_videos_updated_at();
