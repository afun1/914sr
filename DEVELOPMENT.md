# Development Setup Guide

## Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd screen-recorder-app
   npm install
   ```

2. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.example .env.local
   
   # Edit .env.local with your Supabase credentials
   NEXT_PUBLIC_SUPABASE_URL=https://bwvxctexiseobyqcublc.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3dnhjdGV4aXNlb2J5cWN1YmxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNzc1NzMsImV4cCI6MjA3MDg1MzU3M30.7QGmKxE24-BfbEJpxFrxORAJuN_ZLzt9-d6904Gx0ug
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript compiler check |

## Project Structure

```
src/
├── app/                    # Next.js 15 App Router
│   ├── layout.tsx         # Root layout with metadata
│   ├── page.tsx           # Home page
│   └── icon.tsx           # App icon generation
├── components/            # React components
│   ├── AuthWrapper.tsx    # Supabase authentication wrapper
│   ├── ScreenRecorderSimple.tsx # Main recording component
│   ├── BrowserCompatibilityCheck.tsx # Browser support check
│   └── ErrorBoundary.tsx  # Error handling
├── lib/                   # Utilities and configuration
│   └── supabase.ts        # Supabase client setup
└── styles/
    └── globals.css        # Global styles with Tailwind
```

## Key Features

### Authentication Flow
- Supabase Auth with email/password and OAuth
- Protected routes and session management
- Automatic token refresh

### Screen Recording
- High-quality screen capture with audio
- Multiple quality presets (720p to 1440p)
- Real-time recording timer
- Download recordings locally

### Error Handling
- Browser compatibility checks
- Graceful error boundaries
- User-friendly error messages

### UI/UX
- Responsive design with Tailwind CSS
- Modern, accessible interface
- Loading states and feedback

## Development Tips

### Testing Locally
1. Use Chrome/Chromium for best compatibility
2. Test on HTTPS (use ngrok for external testing)
3. Grant screen recording permissions when prompted

### Browser Compatibility
- **Chrome/Edge**: Full support
- **Firefox**: Good support, some codec limitations
- **Safari**: Limited support (macOS only)

### Common Issues
1. **HTTPS Required**: Screen recording APIs require HTTPS
2. **Permissions**: User must grant screen sharing permissions
3. **Codec Support**: VP9 codec preferred but not universal

### Code Style
- Use TypeScript for type safety
- Follow React hooks best practices
- Use Tailwind CSS for styling
- Keep components focused and reusable

## Adding New Features

### Recording Settings
The app supports configurable recording settings:
- Video quality (resolution and bitrate)
- Frame rate (15-60 FPS)
- Audio inclusion toggle

### Database Integration
For storing recordings or user data:
1. Create tables in Supabase
2. Add API routes in `src/app/api/`
3. Use Supabase client for database operations

### Analytics
To add usage tracking:
1. Install analytics library
2. Add tracking events in components
3. Respect user privacy preferences

## Troubleshooting

### Build Issues
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Type check
npx tsc --noEmit
```

### Runtime Issues
1. Check browser console for errors
2. Verify environment variables are set
3. Test Supabase connection
4. Check network requests in DevTools

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
