import { NextResponse } from 'next/server';

/** PWA manifest (PRD §24 installable, mobile-first). */
export function GET() {
  return NextResponse.json({
    name: 'PlaySplit',
    short_name: 'PlaySplit',
    description: 'Smart Sports Subscription & Expense Management',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#16a34a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
}
