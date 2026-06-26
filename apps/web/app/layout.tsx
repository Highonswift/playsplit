import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PlaySplit — Smart Sports Subscriptions',
  description:
    'Manage recurring ground bookings, subscriptions, attendance, wallets and fair cost-sharing for sports groups.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'PlaySplit', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
