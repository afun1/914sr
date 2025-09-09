import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "⚡ Sparky Screen Recorder - Lightning Fast Screen Recording",
  description: "Professional screen recording with lightning-fast performance. Record your screen in high quality with pause/resume, quality settings, and recording history.",
  keywords: "sparky, screen recorder, screen capture, video recording, web app, professional recording, pause resume",
  authors: [{ name: "Sparky Screen Recorder" }],
  icons: {
    icon: [
      { url: '/supersparky.png' },
      { url: '/supersparky.png', sizes: '32x32', type: 'image/png' },
      { url: '/supersparky.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/supersparky.png',
    apple: '/supersparky.png',
  },
  openGraph: {
    title: "⚡ Sparky Screen Recorder",
    description: "Lightning-fast screen recording with professional features including pause/resume, quality settings, and recording history.",
    type: "website",
  },
  robots: "index, follow",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/supersparky.png" sizes="any" />
        <link rel="icon" href="/supersparky.png" type="image/png" />
        <link rel="apple-touch-icon" href="/supersparky.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
