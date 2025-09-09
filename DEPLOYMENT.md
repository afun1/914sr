# Deployment Guide for Screen Recorder App

## Quick Deploy to Vercel (Recommended)

### Prerequisites
1. GitHub account
2. Vercel account (free)
3. Your Supabase project credentials

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit: Screen Recorder App"
git branch -M main
git remote add origin https://github.com/yourusername/screen-recorder-app.git
git push -u origin main
```

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "New Project"
3. Import your GitHub repository
4. Configure environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://bwvxctexiseobyqcublc.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3dnhjdGV4aXNlb2J5cWN1YmxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNzc1NzMsImV4cCI6MjA3MDg1MzU3M30.7QGmKxE24-BfbEJpxFrxORAJuN_ZLzt9-d6904Gx0ug`
5. Click "Deploy"

### Step 3: Configure Supabase Authentication
1. In your Supabase dashboard, go to Authentication > URL Configuration
2. Add your Vercel domain to "Site URL": `https://your-app-name.vercel.app`
3. Add your Vercel domain to "Redirect URLs": `https://your-app-name.vercel.app/auth/callback`

## Alternative Deployment Methods

### Netlify
1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `.next`
4. Add the same environment variables

### Docker (Self-hosted)
```dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS build
COPY . .
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |

## Performance Optimizations

The app includes several optimizations:
- Static generation where possible
- Optimized bundle size with dynamic imports
- Modern image formats support
- Browser compatibility checks
- Error boundaries for graceful error handling

## Security Considerations

- Environment variables are properly prefixed for client-side use
- Supabase handles authentication securely
- No sensitive data is stored client-side
- HTTPS is required for screen recording APIs

## Monitoring and Analytics

Consider adding:
- Vercel Analytics
- Sentry for error tracking
- Google Analytics
- Custom usage metrics

## Custom Domain (Optional)

1. In Vercel dashboard, go to your project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. Update Supabase URL configuration with new domain
