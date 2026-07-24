'use client';

import { useEffect } from 'react';

/** Registers the service worker for installability + offline support. */
export function PWARegister() {
  useEffect(() => {
    // Only run the offline cache in production; in dev it serves stale chunks.
    if (process.env.NODE_ENV !== 'production') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      }
      return;
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failures are non-fatal — the app still works online.
      });
    }
  }, []);
  return null;
}
