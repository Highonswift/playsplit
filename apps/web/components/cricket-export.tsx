'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Share2, Check, WifiOff } from 'lucide-react';
import type { InningsState } from '@playsplit/cricket';

const oversStr = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;

function buildCsv(title: string, state: InningsState, names: Record<string, string>): string {
  const nm = (id?: string | null) => (id ? names[id] ?? 'Player' : '');
  const rows: string[][] = [];
  rows.push([title]);
  rows.push([`Total`, `${state.totalRuns}/${state.wickets}`, `${state.oversText} ov`]);
  rows.push([]);
  rows.push(['Batting', 'R', 'B', '4s', '6s', 'SR', 'Dismissal']);
  for (const b of state.batting) rows.push([nm(b.playerId), `${b.runs}`, `${b.balls}`, `${b.fours}`, `${b.sixes}`, `${b.strikeRate}`, b.out ? b.dismissal ?? 'out' : 'not out']);
  rows.push([]);
  rows.push(['Bowling', 'O', 'M', 'R', 'W']);
  for (const b of state.bowling) rows.push([nm(b.playerId), oversStr(b.legalBalls), `${b.maidens}`, `${b.runs}`, `${b.wickets}`]);
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
}

/** Export the scorecard as CSV and share the match link (§21). */
export function ExportBar({
  state, names, title,
}: {
  state: InningsState; names: Record<string, string>; title: string;
}) {
  const [copied, setCopied] = useState(false);

  function downloadCsv() {
    const csv = buildCsv(title, state, names);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-scorecard.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function share() {
    const shareData = { title, text: `${title} — live on PitchLive`, url: window.location.href };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* fall through to copy */ }
    }
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex gap-2">
      <button className="btn-outline flex-1" onClick={downloadCsv}>
        <Download size={15} /> CSV
      </button>
      <button className="btn-outline flex-1" onClick={share}>
        {copied ? <Check size={15} className="text-primary" /> : <Share2 size={15} />}
        {copied ? 'Link copied' : 'Share'}
      </button>
    </div>
  );
}

/**
 * Online/offline status (§20). Shows a banner when offline; refreshes on
 * reconnect so any changes made elsewhere are pulled in.
 */
export function OfflineBanner() {
  const router = useRouter();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    const onOnline = () => { setOffline(false); router.refresh(); };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [router]);

  if (!offline) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl bg-warning/15 px-3 py-2 text-sm font-medium text-warning">
      <WifiOff size={16} /> You&apos;re offline — the score will sync when you reconnect.
    </div>
  );
}
