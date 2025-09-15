## IMPORTANT: Supabase Configuration for Impersonation

To fix the redirect issue where impersonation goes to the deployed site instead of localhost:

### 1. Add Localhost to Supabase Redirect URLs

Go to your Supabase Dashboard:
1. Navigate to **Authentication** → **URL Configuration**
2. In **Redirect URLs**, add these entries:
   ```
   http://localhost:3000/users
   http://localhost:3001/users  
   http://localhost:3002/users
   https://97sr.vercel.app/users
   ```

### 2. Alternative: Site URL Override

Or update your **Site URL** in Supabase to:
- **Development**: `http://localhost:3000`  
- **Production**: `https://97sr.vercel.app`

### 3. Environment Variables

Make sure your `.env.local` has:
```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # for development
```

### 4. Test the Fix

After updating Supabase settings:
1. Restart your dev server
2. Try impersonation again
3. Should now redirect to localhost:3000/users

The magic link redirect URL is controlled by Supabase's dashboard settings, not our API code.