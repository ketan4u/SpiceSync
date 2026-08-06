import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SpiceSync — find your food identity',
  description:
    'A dating app for India, built around the one thing we all have opinions about. Take the 90-second food quiz.',
  applicationName: 'SpiceSync',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'SpiceSync' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffaf3' },
    { media: '(prefers-color-scheme: dark)', color: '#14100d' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
