# Sparky Screen Recorder

A modern screen recording application with intelligent folder management and user organization.

## 🚀 Latest Features

- **Smart Folder Management** - Intelligent user-based organization
- **Auto-Organization** - Videos automatically sorted by user
- **User Search & Creation** - Quick folder setup for new users
- **Impersonation System** - Easy user testing and management
- **Next.js 15 Compatible** - Latest framework support

## 🎯 Admin Features

- `/folders` - Smart folder management with user search
- `/users` - User management with impersonation
- Auto-detection and folder creation for new recordings
- Purple (simple) and Blue (full setup) folder creation options

## 📋 Technical Stack

- Next.js 15.5.2 with Turbopack
- Supabase for database and authentication
- Vimeo API for video storage and organization
- TypeScript for type safety
- Tailwind CSS for styling

## 🔧 Deployment Ready

This system is production-ready with comprehensive error handling, user management, and automated video organization.

## ✨ Features

- 🔐 **Secure Authentication**: Email/password authentication powered by Supabase
- 🎥 **Professional Recording**: High-quality screen capture with configurable quality settings
- ⏸️ **Pause & Resume**: Advanced recording controls with real-time pause/resume functionality
- 📊 **Recording History**: Persistent storage and management of all recordings with thumbnails
- ⌨️ **Keyboard Shortcuts**: Lightning-fast controls with comprehensive hotkey support
- 🎚️ **Quality Settings**: Multiple recording quality options (High, Medium, Low)
- 🔊 **Audio Control**: Toggle system audio recording on/off
- ⚡ **Lightning Fast**: Optimized performance with 3-second countdown and instant controls
- 📱 **Responsive Design**: Beautiful orange-themed interface built with Tailwind CSS
- ☁️ **Vercel Ready**: Optimized for seamless deployment on Vercel
- 🚀 **Modern Stack**: Next.js 15 with TypeScript and App Router

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd sparky-screen-recorder
```

2. Install dependencies:
```bash
npm install
```

## ⌨️ Keyboard Shortcuts

Sparky Screen Recorder includes comprehensive keyboard shortcuts for lightning-fast operation:

- **SPACE** - Start recording / Pause or Resume during recording
- **ESC** - Stop recording immediately
- **H** - Toggle recording history view
- **Ctrl+D** - Download current recording
- **Ctrl+R** - Record again (clears current and starts new)

## 🛠️ Setup

### Environment Variables
### Environment Variables
Create a `.env.local` file in the root directory:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Running the Application

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Deploy to Vercel

1. Push your code to a GitHub repository
2. Connect your GitHub account to Vercel
3. Import your repository in Vercel
4. Add your environment variables in Vercel's dashboard
5. Deploy!

The app is optimized for Vercel deployment with automatic builds and deployments.

## Usage

1. **Sign In**: Use your email/password or OAuth providers to authenticate
2. **Start Recording**: Click "Start Recording" and select the screen/window to capture
3. **Stop Recording**: Click "Stop Recording" when finished
4. **Download**: Preview your recording and download it locally

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **Recording**: MediaRecorder API

## Browser Support

- Chrome/Chromium browsers (recommended)
- Firefox
- Edge
- Safari (limited screen recording support)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
