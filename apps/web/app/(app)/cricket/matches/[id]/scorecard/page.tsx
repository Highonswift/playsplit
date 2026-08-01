import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getActiveGroup } from '@/lib/groups';
import { getCricketMatch, FORMAT_LABELS } from '@/lib/cricket';
import { getInningsCards, type InningsCard } from '@/lib/scoring';
import { Scorecard } from '@/components/scoring';
import { CommentaryFeed } from '@/components/commentary';
import { ScorecardExportBar } from '@/components/cricket-export';

const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const oversStr = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;

function cardName(c: InningsCard, teamAId: string, aName: string, bName: string) {
  return c.battingTeamId === teamAId ? aName : bName;
}

function buildShareText(title: string, result: string | null, lines: string[]): string {
  return [`🏏 ${title}`, result ?? 'In progress', '', ...lines, '', '— scored on PitchLive'].join('\n');
}

function buildCsv(title: string, cards: InningsCard[], name: (c: InningsCard) => string): string {
  const rows: string[][] = [[title], []];
  for (const c of cards) {
    const nm = (id?: string | null) => (id ? c.names[id] ?? 'Player' : '');
    rows.push([`${name(c)} — ${c.state.totalRuns}/${c.state.wickets}`, `${c.state.oversText} ov`]);
    rows.push(['Batting', 'R', 'B', '4s', '6s', 'SR', 'Dismissal']);
    for (const b of c.state.batting)
      rows.push([nm(b.playerId), `${b.runs}`, `${b.balls}`, `${b.fours}`, `${b.sixes}`, `${b.strikeRate}`, b.out ? b.dismissal ?? 'out' : 'not out']);
    rows.push(['Bowling', 'O', 'M', 'R', 'W']);
    for (const b of c.state.bowling)
      rows.push([nm(b.playerId), oversStr(b.legalBalls), `${b.maidens}`, `${b.runs}`, `${b.wickets}`]);
    rows.push([]);
  }
  return rows.map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n');
}

export default async function ScorecardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const m = await getCricketMatch(id);
  if (!m) notFound();

  const isPickup = m.match_type === 'pickup';
  const lastManStands = !!group.cricket_rules?.last_man_stands;
  const cards = await getInningsCards(id, m.players_per_side, m.overs, isPickup, lastManStands);

  const title = `${m.team_a.name} vs ${m.team_b.name}`;
  const name = (c: InningsCard) => cardName(c, m.team_a.id, m.team_a.name, m.team_b.name);
  const resultText = (m as { result_text?: string | null }).result_text ?? null;

  const summaryLines = cards.map(
    (c) => `${name(c)}  ${c.state.totalRuns}/${c.state.wickets} (${c.state.oversText})`,
  );
  const shareText = buildShareText(title, resultText, summaryLines);
  const csv = buildCsv(title, cards, name);
  const csvName = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-scorecard.csv`;

  return (
    <div className="space-y-5">
      <Link href={`/cricket/matches/${id}`} className="inline-flex items-center gap-1 text-sm text-muted print:hidden">
        <ArrowLeft size={16} /> Back to match
      </Link>

      {/* Match header */}
      <div className="card text-center">
        <h1 className="font-display text-xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">
          {FORMAT_LABELS[m.format]}{m.overs ? ` · ${m.overs} ov` : ''} · {m.match_date}
          {m.venue ? ` · ${m.venue}` : ''}
        </p>
        {resultText && (
          <p className="mt-2 rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-dark">
            {resultText}
          </p>
        )}
      </div>

      {cards.length === 0 ? (
        <p className="card text-center text-sm text-muted">No innings played yet.</p>
      ) : (
        <>
          <ScorecardExportBar csv={csv} csvName={csvName} shareText={shareText} matchPath={`/cricket/matches/${id}`} />

          {/* Both innings, full scorecards */}
          {cards.map((c) => (
            <div key={c.number} className="space-y-3">
              <h2 className="font-display text-sm font-bold text-muted">{ordinal(c.number)} innings</h2>
              <Scorecard state={c.state} names={c.names} battingTeamName={name(c)} battingSquad={c.battingSquad} />
            </div>
          ))}

          {/* Commentary per innings */}
          <div className="space-y-3">
            <h2 className="font-display text-sm font-bold text-muted">Commentary</h2>
            {cards.map((c) => (
              <div key={c.number} className="space-y-2">
                <p className="text-xs font-semibold text-muted">{ordinal(c.number)} innings — {name(c)}</p>
                <CommentaryFeed state={c.state} names={c.names} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
