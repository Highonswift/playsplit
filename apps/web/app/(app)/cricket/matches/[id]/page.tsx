import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin, CalendarDays, Coins } from 'lucide-react';
import { getActiveGroup, getGroupMembers } from '@/lib/groups';
import { getCricketMatch, getPoolPlayers, getMyLinkedPlayer, FORMAT_LABELS } from '@/lib/cricket';
import { getScoringData, getSidePlayers, getMatchSquad } from '@/lib/scoring';
import { LatePlayerAdder } from '@/components/pickup';
import { getOfficials } from '@/lib/officials';
import { getUser } from '@/lib/supabase/server';
import { TossForm } from '@/components/cricket-forms';
import { winProbability } from '@playsplit/cricket';
import { StartInningsForm, LiveScoreboard, ScoringPad, Scorecard } from '@/components/scoring';
import { LiveSync, ControlBar } from '@/components/cricket-realtime';
import { CommentaryFeed } from '@/components/commentary';
import { ExportBar, OfflineBanner } from '@/components/cricket-export';
import { OfficialsManager } from '@/components/officials';
import { FinishMatchButtons } from '@/components/finish-match';
import { Badge } from '@/components/ui';

export default async function CricketMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // These three are independent — fetch together (getUser is request-cached).
  const [group, m, user] = await Promise.all([getActiveGroup(), getCricketMatch(id), getUser()]);
  if (!group) redirect('/groups');
  if (!m) notFound();
  const isAdmin = group.role !== 'player';

  const tossDone = !!m.toss_winner_team_id;
  const tossWinner = m.toss_winner_team_id === m.team_a.id ? m.team_a : m.team_b;
  const battingFirst = m.batting_first_team_id === m.team_a.id ? m.team_a : m.team_b;
  const bowlingFirst = m.batting_first_team_id === m.team_a.id ? m.team_b : m.team_a;
  const isPickup = m.match_type === 'pickup';

  // One parallel wave for everything that only needs the match (not the
  // derived innings state) — turns a chain of round-trips into a single hop.
  const [scoring, officials, members, squadA, squadB, pool, myPlayer] = await Promise.all([
    tossDone ? getScoringData(id, m.players_per_side, m.overs, isPickup) : Promise.resolve(null),
    tossDone ? getOfficials(id) : Promise.resolve([]),
    tossDone ? getGroupMembers(group.id) : Promise.resolve([]),
    isPickup && tossDone ? getMatchSquad(id, m.team_a.id) : Promise.resolve([]),
    isPickup && tossDone ? getMatchSquad(id, m.team_b.id) : Promise.resolve([]),
    isPickup && tossDone && m.status !== 'completed' ? getPoolPlayers(group.id) : Promise.resolve([]),
    isPickup && user ? getMyLinkedPlayer(group.id, user.id) : Promise.resolve(null),
  ]);
  const teamName = (tid: string) =>
    tid === m.team_a.id ? m.team_a.short_name ?? m.team_a.name : m.team_b.short_name ?? m.team_b.name;

  // Admins & assigned officials can score any match; for pickup games, so can
  // any member who has claimed their player.
  const canScore =
    isAdmin ||
    officials.some((o) => o.user_id === user?.id && o.can_score) ||
    (isPickup && !!myPlayer);
  const controllerId = m.scoring_control_user_id;
  const iAmController = !!controllerId && controllerId === user?.id;
  const nameOf = (uid: string) =>
    officials.find((o) => o.user_id === uid)?.full_name ??
    members.find((mm) => mm.user_id === uid)?.full_name ?? 'Umpire';
  const controllerName = controllerId ? (iAmController ? 'You' : nameOf(controllerId)) : null;

  // Win probability for a chase (§8.1).
  const winProb =
    scoring?.innings?.target != null && scoring.ballsRemaining != null && scoring.state
      ? winProbability(scoring.innings.target, scoring.state.totalRuns, scoring.state.wickets, scoring.ballsRemaining, m.players_per_side)
      : null;

  // Players for whichever team needs to start batting next.
  const firstInnings = scoring?.allInnings?.[0] ?? null;
  const secondInningsNeeded =
    scoring && scoring.allInnings.length === 1 && scoring.state?.complete && m.status !== 'completed';
  const [battingFirstPlayers, secondBattingPlayers] = await Promise.all([
    tossDone && !scoring?.innings ? getSidePlayers(id, battingFirst.id, isPickup) : Promise.resolve([]),
    secondInningsNeeded ? getSidePlayers(id, bowlingFirst.id, isPickup) : Promise.resolve([]),
  ]);

  // Pickup: pool players not yet on either side, for mid-match late joins.
  // Squads + pool were already fetched above, so this is just a filter.
  const inMatchIds = new Set([...squadA, ...squadB].map((p) => p.id));
  const latePool =
    isPickup && canScore && tossDone && m.status !== 'completed'
      ? pool.filter((p) => !inMatchIds.has(p.id))
      : [];

  return (
    <div className="space-y-5">
      <Link href="/cricket" className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft size={16} /> Cricket
      </Link>
      <LiveSync matchId={m.id} inningsId={scoring?.innings?.id ?? null} />
      <OfflineBanner />

      {/* Match header */}
      <div className="card">
        <div className="flex items-center justify-between">
          {[m.team_a, m.team_b].map((t, i) => (
            <div key={t.id} className={`flex flex-1 flex-col items-center gap-1.5 ${i === 0 ? '' : 'order-2'}`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: t.color }}>
                {(t.short_name ?? t.name).slice(0, 3).toUpperCase()}
              </span>
              <span className="text-center text-sm font-semibold">{t.name}</span>
            </div>
          ))}
          <span className="order-1 px-3 font-display text-sm font-bold text-muted">vs</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Badge tone="neutral">{FORMAT_LABELS[m.format]}{m.overs ? ` · ${m.overs} ov` : ''}</Badge>
          <Badge tone="neutral">{m.players_per_side}-a-side</Badge>
          <Badge tone={m.status === 'live' ? 'live' : m.status === 'completed' ? 'success' : 'info'} className="capitalize">
            {m.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="mt-3 flex flex-col items-center gap-1 text-sm text-muted">
          <span className="flex items-center gap-1.5"><CalendarDays size={13} /> {m.match_date}{m.start_time ? ` · ${m.start_time}` : ''}</span>
          {m.venue && <span className="flex items-center gap-1.5"><MapPin size={13} /> {m.venue}</span>}
        </div>
        {m.status === 'completed' && (m as { result_text?: string }).result_text && (
          <p className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-center text-sm font-semibold text-primary-dark">
            {(m as { result_text?: string }).result_text}
          </p>
        )}
      </div>

      {/* Toss */}
      <div className="card">
        <div className="mb-2 flex items-center gap-2">
          <Coins size={16} className="text-muted" />
          <h2 className="font-semibold">Toss</h2>
        </div>
        {tossDone ? (
          <p className="text-sm">
            <span className="font-semibold">{tossWinner.name}</span> won the toss and elected to{' '}
            <span className="font-semibold">{m.toss_decision === 'bat' ? 'bat' : 'bowl'}</span> first.{' '}
            <span className="font-semibold">{battingFirst.name}</span> bats first.
          </p>
        ) : canScore ? (
          <TossForm matchId={m.id} teamA={m.team_a} teamB={m.team_b} />
        ) : (
          <p className="text-sm text-muted">Toss not recorded yet.</p>
        )}
      </div>

      {/* Match officials (admin) */}
      {isAdmin && tossDone && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Match officials</h2>
          <OfficialsManager
            matchId={m.id}
            officials={officials}
            members={members.map((mm) => ({ user_id: mm.user_id, full_name: mm.full_name }))}
          />
        </div>
      )}

      {/* Late arrivals (pickup) — admins & scorers can add players mid-match */}
      {isPickup && canScore && tossDone && m.status !== 'completed' && (
        <div className="card">
          <h2 className="mb-1 font-semibold">Add a late arrival</h2>
          <p className="stat-label mb-3">Someone just showed up? Drop them into a side.</p>
          <LatePlayerAdder
            matchId={m.id}
            teams={[
              { id: m.team_a.id, name: m.team_a.name },
              { id: m.team_b.id, name: m.team_b.name },
            ]}
            available={latePool.map((p) => ({ id: p.id, full_name: p.full_name }))}
          />
        </div>
      )}

      {/* Scoring */}
      {tossDone && scoring && (
        <>
          {/* Live + pad */}
          {scoring.innings && scoring.state && !scoring.state.complete && (
            <>
              <LiveScoreboard
                state={scoring.state}
                names={scoring.names}
                battingTeamName={teamName(scoring.innings.batting_team_id)}
                requiredRunRate={scoring.requiredRunRate}
                ballsRemaining={scoring.ballsRemaining}
                target={scoring.innings.target}
                winProb={winProb}
              />
              {canScore && (
                <ControlBar
                  matchId={m.id}
                  controllerName={controllerName}
                  iAmController={iAmController}
                  canScore={canScore}
                />
              )}
              {iAmController && (
                <div className="card">
                  <h2 className="mb-3 font-semibold">Scoring</h2>
                  <ScoringPad
                    matchId={m.id}
                    inningsId={scoring.innings.id}
                    state={scoring.state}
                    bowlingPlayers={scoring.bowlingPlayers}
                    battingPlayers={scoring.battingPlayers}
                    names={scoring.names}
                    deliveryCount={scoring.deliveryCount}
                  />
                </div>
              )}
              {canScore && !iAmController && (
                <div className="card border-dashed text-center text-sm text-muted">
                  Take control above to update the score.
                </div>
              )}
            </>
          )}

          {/* Export & share */}
          {scoring.state && scoring.state.timeline.length > 0 && (
            <ExportBar state={scoring.state} names={scoring.names} title={`${m.team_a.name} vs ${m.team_b.name}`} />
          )}

          {/* Scorecard */}
          {scoring.state && <Scorecard state={scoring.state} names={scoring.names} />}

          {/* Commentary */}
          {scoring.state && <CommentaryFeed state={scoring.state} names={scoring.names} />}

          {/* Start innings 1 */}
          {!scoring.innings && canScore && (
            <div className="card">
              <h2 className="mb-3 font-semibold">Start 1st innings — {battingFirst.name} batting</h2>
              <StartInningsForm
                matchId={m.id}
                number={1}
                battingTeamId={battingFirst.id}
                bowlingTeamId={bowlingFirst.id}
                battingPlayers={battingFirstPlayers}
              />
            </div>
          )}

          {/* Start innings 2 */}
          {secondInningsNeeded && canScore && firstInnings && scoring.state && (
            <div className="card">
              <h2 className="mb-3 font-semibold">Start 2nd innings — {bowlingFirst.name} chasing {scoring.state.totalRuns + 1}</h2>
              <StartInningsForm
                matchId={m.id}
                number={2}
                battingTeamId={bowlingFirst.id}
                bowlingTeamId={battingFirst.id}
                battingPlayers={secondBattingPlayers}
                target={scoring.state.totalRuns + 1}
              />
            </div>
          )}

          {/* Finish match */}
          {canScore && scoring.allInnings.length >= 2 && scoring.state?.complete && m.status !== 'completed' && (
            <div className="card">
              <h2 className="mb-3 font-semibold">Finish match</h2>
              <FinishMatchButtons
                matchId={m.id}
                teamA={{ id: m.team_a.id, name: m.team_a.name }}
                teamB={{ id: m.team_b.id, name: m.team_b.name }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
