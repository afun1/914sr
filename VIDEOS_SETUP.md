# Videos Table Setup Instructions

To enable the customer information and video metadata storage features, you need to run the videos table setup in your Supabase database.

## Steps:

1. **Open Supabase Dashboard**
   - Go to your project dashboard at https://supabase.com/dashboard
   - Navigate to the SQL Editor

2. **Run the Videos Table Setup**
   - Copy the contents of `videos_table_setup.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute the script

3. **Verify Table Creation**
   - Go to the Table Editor
   - You should see a new `videos` table with the following columns:
     - `id` (UUID, Primary Key)
     - `title` (Text)
     - `description` (Text, Nullable)
     - `vimeo_uri`, `vimeo_id`, `vimeo_url` (Vimeo integration fields)
     - `duration`, `file_size` (Video metadata)
     - `user_id` (Foreign key to auth.users)
     - `customer_name`, `customer_email` (Customer information)
     - `created_at`, `updated_at`, `recorded_at` (Timestamps)

## Features Enabled:

### ✅ Customer Information Storage
- Customer name and email are saved with each recording
- Metadata is preserved for both user and admin views

### ✅ Admin Video Management
- Admins can see all videos with customer information
- Enhanced video tiles showing:
  - Customer Name
  - Customer Email  
  - User Display Name (who recorded it)
  - Recording timestamp

### ✅ User Video Library
- Users can see their own uploaded recordings
- Videos are organized with customer information
- Direct links to Vimeo for playback

### ✅ Role-Based Access Control
- Users can only see their own videos
- Admins/Supervisors/Managers can see all videos
- Appropriate edit/delete permissions based on role

## Row Level Security (RLS)

The table includes comprehensive RLS policies:
- Users can view/edit their own videos
- Admins can view/edit all videos
- Only admins can delete videos (configurable)

This ensures data privacy and security while allowing administrative oversight.
