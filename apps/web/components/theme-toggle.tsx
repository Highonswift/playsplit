'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

function apply(theme: Theme) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

/** Cycles light → dark → system, persisted to localStorage. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  // Load the stored preference first; only THEN start persisting/applying, so
  // the initial default 'system' never clobbers a saved 'dark'/'light'.
  useEffect(() => {
    setTheme((localStorage.getItem('theme') as Theme) || 'system');
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (theme === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', theme);
    apply(theme);
  }, [theme, mounted]);

  const next: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const labels: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' };

  if (compact) {
    return (
      <button
        onClick={() => setTheme(next[theme])}
        aria-label={`Theme: ${labels[theme]}`}
        className="btn-ghost rounded-xl p-2"
      >
        <Icon size={20} />
      </button>
    );
  }

  return (
    <button onClick={() => setTheme(next[theme])} className="btn-ghost w-full justify-start gap-3">
      <Icon size={20} />
      {labels[theme]} theme
    </button>
  );
}
