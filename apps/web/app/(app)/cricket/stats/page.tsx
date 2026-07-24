import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Trophy, Target, Hand } from 'lucide-react';
import { getActiveGroup } from '@/lib/groups';
import { getCricketStats } from '@/lib/stats';
import { EmptyState } from '@/components/ui';

const oversStr = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

export default async function CricketStatsPage() {
  const group = await getActiveGroup();
  if (!group) redirect('/groups');
  const stats = await getCricketStats(group.id);

  const topRuns = stats.batting.slice(0, 3);
  const topWickets = stats.bowling.filter((b) => b.wickets > 0).slice(0, 3);
  const hasData = stats.batting.length > 0 || stats.bowling.length > 0;

  return (
    <div className="space-y-5">
      <Link href="/cricket" className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft size={16} /> Cricket
      </Link>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Statistics</h1>

      {!hasData ? (
        <EmptyState icon={Trophy} title="No stats yet" hint="Play and score a match to see player and team statistics." />
      ) : (
        <>
          {/* Leaderboards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card">
              <div className="mb-2 flex items-center gap-2"><Trophy size={16} className="text-warning" /><h2 className="font-semibold">Most runs</h2></div>
              <ul className="space-y-1.5">
                {topRuns.map((b, i) => (
                  <li key={b.playerId} className="flex items-center justify-between text-sm">
                    <span><span className="mr-2 text-muted">{i + 1}</span>{b.name}</span>
                    <span className="font-bold tabular">{b.runs}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="mb-2 flex items-center gap-2"><Target size={16} className="text-info" /><h2 className="font-semibold">Most wickets</h2></div>
              {topWickets.length === 0 ? <p className="text-sm text-muted">No wickets yet.</p> : (
                <ul className="space-y-1.5">
                  {topWickets.map((b, i) => (
                    <li key={b.playerId} className="flex items-center justify-between text-sm">
                      <span><span className="mr-2 text-muted">{i + 1}</span>{b.name}</span>
                      <span className="font-bold tabular">{b.wickets}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Batting */}
          <div className="card">
            <h2 className="mb-2 font-semibold">Batting</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted">
                  <th className="py-1 font-medium">Player</th><th className="py-1 text-right font-medium">M</th><th className="py-1 text-right font-medium">I</th><th className="py-1 text-right font-medium">Runs</th><th className="py-1 text-right font-medium">HS</th><th className="py-1 text-right font-medium">Avg</th><th className="py-1 text-right font-medium">SR</th><th className="py-1 text-right font-medium">50/100</th>
                </tr></thead>
                <tbody>
                  {stats.batting.map((b) => (
                    <tr key={b.playerId} className="border-t border-divider">
                      <td className="py-1.5 font-medium">{b.name}</td>
                      <td className="py-1.5 text-right tabular">{b.matches}</td>
                      <td className="py-1.5 text-right tabular">{b.innings}</td>
                      <td className="py-1.5 text-right font-semibold tabular">{b.runs}</td>
                      <td className="py-1.5 text-right tabular">{b.hs}{b.hsNotOut ? '*' : ''}</td>
                      <td className="py-1.5 text-right tabular text-muted">{b.average ?? '–'}</td>
                      <td className="py-1.5 text-right tabular text-muted">{b.strikeRate}</td>
                      <td className="py-1.5 text-right tabular text-muted">{b.fifties}/{b.hundreds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bowling */}
          {stats.bowling.length > 0 && (
            <div className="card">
              <h2 className="mb-2 font-semibold">Bowling</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted">
                    <th className="py-1 font-medium">Player</th><th className="py-1 text-right font-medium">M</th><th className="py-1 text-right font-medium">O</th><th className="py-1 text-right font-medium">R</th><th className="py-1 text-right font-medium">W</th><th className="py-1 text-right font-medium">Best</th><th className="py-1 text-right font-medium">Econ</th><th className="py-1 text-right font-medium">Avg</th>
                  </tr></thead>
                  <tbody>
                    {stats.bowling.map((b) => (
                      <tr key={b.playerId} className="border-t border-divider">
                        <td className="py-1.5 font-medium">{b.name}</td>
                        <td className="py-1.5 text-right tabular">{b.matches}</td>
                        <td className="py-1.5 text-right tabular">{oversStr(b.balls)}</td>
                        <td className="py-1.5 text-right tabular">{b.runs}</td>
                        <td className="py-1.5 text-right font-semibold tabular">{b.wickets}</td>
                        <td className="py-1.5 text-right tabular">{b.best}</td>
                        <td className="py-1.5 text-right tabular text-muted">{b.economy}</td>
                        <td className="py-1.5 text-right tabular text-muted">{b.average ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fielding */}
          {stats.fielding.some((f) => f.catches + f.runOuts + f.stumpings > 0) && (
            <div className="card">
              <div className="mb-2 flex items-center gap-2"><Hand size={16} className="text-muted" /><h2 className="font-semibold">Fielding</h2></div>
              <ul className="divide-y divide-divider">
                {stats.fielding.filter((f) => f.catches + f.runOuts + f.stumpings > 0).map((f) => (
                  <li key={f.playerId} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted tabular">{f.catches} ct · {f.runOuts} ro · {f.stumpings} st</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Team records */}
          {stats.teams.length > 0 && (
            <div className="card">
              <h2 className="mb-2 font-semibold">Team records</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted">
                    <th className="py-1 font-medium">Team</th><th className="py-1 text-right font-medium">P</th><th className="py-1 text-right font-medium">W</th><th className="py-1 text-right font-medium">L</th><th className="py-1 text-right font-medium">T</th><th className="py-1 text-right font-medium">Win%</th>
                  </tr></thead>
                  <tbody>
                    {stats.teams.map((t) => (
                      <tr key={t.teamId} className="border-t border-divider">
                        <td className="py-1.5 font-medium">{t.name}</td>
                        <td className="py-1.5 text-right tabular">{t.played}</td>
                        <td className="py-1.5 text-right font-semibold tabular">{t.won}</td>
                        <td className="py-1.5 text-right tabular">{t.lost}</td>
                        <td className="py-1.5 text-right tabular">{t.tied}</td>
                        <td className="py-1.5 text-right tabular text-muted">{t.winPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
