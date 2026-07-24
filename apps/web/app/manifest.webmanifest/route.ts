import { NextResponse } from 'next/server';

/** PWA manifest (PRD §24 installable, mobile-first). */
export function GET() {
  return NextResponse.json({
    name: 'PitchLive',
    short_name: 'PitchLive',
    description: 'Live Sports & Cricket Scoring · matches, subscriptions, fair cost-sharing',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0f0d',
    theme_color: '#16a34a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  });
}
