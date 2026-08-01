import type {
  Ball,
  BatCard,
  BowlCard,
  FallOfWicket,
  InningsSetup,
  InningsState,
  Partnership,
  TimelineEntry,
  Wicket,
} from './types';

export function oversText(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

const BOWLER_CREDITED: Record<string, boolean> = {
  bowled: true, caught: true, lbw: true, stumped: true, hit_wicket: true,
  run_out: false, retired_out: false, retired_hurt: false, obstructing: false,
  hit_twice: false, timed_out: false,
};

function dismissalLabel(w: Wicket): string {
  switch (w.type) {
    case 'bowled': return 'bowled';
    case 'lbw': return 'lbw';
    case 'caught': return 'caught';
    case 'run_out': return 'run out';
    case 'stumped': return 'stumped';
    case 'hit_wicket': return 'hit wicket';
    case 'retired_out': return 'retired out';
    case 'retired_hurt': return 'retired hurt';
    case 'obstructing': return 'obstructing the field';
    case 'hit_twice': return 'hit the ball twice';
    case 'timed_out': return 'timed out';
    default: return 'out';
  }
}

/**
 * Derive full innings state from an ordered list of deliveries (§8, §12).
 * Pure & deterministic — the DB stores deliveries append-only and this recomputes
 * everything, which is what makes undo (drop the last delivery) trivially correct.
 */
export function computeInnings(setup: InningsSetup, balls: Ball[]): InningsState {
  let striker: string | null = setup.strikerId;
  let nonStriker: string | null = setup.nonStrikerId;
  let bowlerId: string | null = balls.length > 0 ? balls[balls.length - 1]!.bowlerId : null;

  let total = 0;
  let wickets = 0;
  let legalBalls = 0;
  const extras = { wide: 0, noball: 0, bye: 0, legbye: 0, penalty: 0, total: 0 };

  const bat = new Map<string, BatCard>();
  const bowl = new Map<string, BowlCard>();
  const fow: FallOfWicket[] = [];
  const partnerships: Partnership[] = [];
  const timeline: TimelineEntry[] = [];
  const overGroups: string[][] = [];
  let overSymbols: string[] = [];

  let order = 0;
  const getBat = (id: string): BatCard => {
    let c = bat.get(id);
    if (!c) {
      c = { playerId: id, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: null, order: order++, strikeRate: 0 };
      bat.set(id, c);
    }
    return c;
  };
  const getBowl = (id: string): BowlCard => {
    let c = bowl.get(id);
    if (!c) {
      c = { playerId: id, legalBalls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noballs: 0, dots: 0 };
      bowl.set(id, c);
    }
    return c;
  };

  // Seed the opening pair so they appear even before facing a ball.
  getBat(striker);
  getBat(nonStriker);
  let pRuns = 0;
  let pBalls = 0;

  let overCharged = 0;
  let overBowler: string | null = null;

  const swap = () => {
    // A lone batter (last-man-stands) has no partner, so strike never rotates —
    // they keep the strike on odd runs and at the end of the over.
    if (striker === null || nonStriker === null) return;
    const t = striker;
    striker = nonStriker;
    nonStriker = t;
  };

  for (const b of balls) {
    bowlerId = b.bowlerId;
    const bw = getBowl(b.bowlerId);
    if (overBowler === null) overBowler = b.bowlerId;

    const isWide = b.extra === 'wide';
    const isNoball = b.extra === 'noball';
    const isBye = b.extra === 'bye';
    const isLegbye = b.extra === 'legbye';
    const isPenalty = b.extra === 'penalty';

    // Penalty runs — awarded without a delivery.
    if (isPenalty) {
      total += b.extraRuns;
      extras.penalty += b.extraRuns;
      extras.total += b.extraRuns;
      pRuns += b.extraRuns;
      overSymbols.push(`P${b.extraRuns}`);
      continue;
    }

    const facing = striker;
    let charged = 0;
    let strikeRuns = 0;
    let wicketOutId: string | undefined;

    if (isWide) {
      const wr = 1 + b.extraRuns;
      total += wr; extras.wide += wr; extras.total += wr;
      bw.wides += 1; charged = wr;
      strikeRuns = b.extraRuns;
      overSymbols.push(b.extraRuns ? `${wr}wd` : 'wd');
    } else if (isNoball) {
      total += 1; extras.noball += 1; extras.total += 1; bw.noballs += 1;
      const rb = b.runsBat;
      total += rb;
      const bc = getBat(striker!); bc.runs += rb; bc.balls += 1;
      if (rb === 4) bc.fours += 1;
      if (rb === 6) bc.sixes += 1;
      pRuns += rb; pBalls += 1;
      if (b.extraRuns) { total += b.extraRuns; extras.bye += b.extraRuns; extras.total += b.extraRuns; }
      charged = 1 + rb;
      strikeRuns = rb + b.extraRuns;
      overSymbols.push(rb ? `nb${rb}` : 'nb');
    } else if (isBye || isLegbye) {
      total += b.extraRuns;
      if (isBye) extras.bye += b.extraRuns; else extras.legbye += b.extraRuns;
      extras.total += b.extraRuns;
      const bc = getBat(striker!); bc.balls += 1;
      pBalls += 1;
      bw.legalBalls += 1; legalBalls += 1;
      if (b.extraRuns === 0) bw.dots += 1;
      strikeRuns = b.extraRuns;
      overSymbols.push((isLegbye ? 'lb' : 'b') + (b.extraRuns || ''));
    } else {
      const rb = b.runsBat;
      total += rb;
      const bc = getBat(striker!); bc.runs += rb; bc.balls += 1;
      if (rb === 4) bc.fours += 1;
      if (rb === 6) bc.sixes += 1;
      if (rb === 0) bw.dots += 1;
      pRuns += rb; pBalls += 1;
      bw.legalBalls += 1; legalBalls += 1;
      charged = rb;
      strikeRuns = rb;
      overSymbols.push(b.wicket ? (rb ? `${rb}+W` : 'W') : String(rb));
    }

    bw.runs += charged;
    overCharged += charged;
    const isLegal = !isWide && !isNoball;

    // Strike rotation from runs run.
    if (strikeRuns % 2 === 1) swap();

    // Wicket handling.
    if (b.wicket) {
      wickets += 1;
      const outId = b.wicket.outEnd === 'striker' ? striker : nonStriker;
      wicketOutId = outId ?? undefined;
      const oc = getBat(outId!);
      oc.out = true;
      oc.dismissal = dismissalLabel(b.wicket);
      oc.dismissalType = b.wicket.type;
      if (BOWLER_CREDITED[b.wicket.type]) { bw.wickets += 1; oc.outBowlerId = b.bowlerId; }
      if (b.wicket.fielderId) oc.outFielderId = b.wicket.fielderId;
      fow.push({ wicketNumber: wickets, score: total, outPlayerId: outId!, over: oversText(legalBalls) });
      if (striker && nonStriker) {
        partnerships.push({ batter1: striker, batter2: nonStriker, runs: pRuns, balls: pBalls, unbroken: false });
      }
      pRuns = 0; pBalls = 0;
      const incoming = b.wicket.incomingBatterId ?? null;
      if (b.wicket.outEnd === 'striker') striker = incoming; else nonStriker = incoming;
      // Last-man-stands: if one end is now empty but a batter remains, that batter
      // carries on alone and always keeps the strike.
      if (setup.lastManStands && striker === null && nonStriker !== null) {
        striker = nonStriker;
        nonStriker = null;
      }
    }

    timeline.push({
      over: oversText(legalBalls),
      strikerId: facing ?? '',
      bowlerId: b.bowlerId,
      runsBat: b.runsBat,
      extra: b.extra,
      extraRuns: b.extraRuns,
      wicketType: b.wicket?.type,
      wicketOutId,
    });

    // Over completion (on the 6th legal ball).
    if (isLegal && legalBalls % 6 === 0) {
      if (overCharged === 0 && overBowler) getBowl(overBowler).maidens += 1;
      overGroups.push(overSymbols);
      overSymbols = [];
      overCharged = 0;
      overBowler = null;
      swap();
    }
  }

  // Finalise strike rates.
  for (const c of bat.values()) c.strikeRate = c.balls > 0 ? +((c.runs / c.balls) * 100).toFixed(2) : 0;

  // Normally an innings ends when the 2nd-last wicket falls (no batting pair
  // left). With last-man-stands the lone batter continues, so it ends only when
  // every batter is out.
  const allOut = wickets >= (setup.lastManStands ? setup.playersPerSide : setup.playersPerSide - 1);
  const oversUp = setup.maxOvers !== null && legalBalls >= setup.maxOvers * 6;
  const complete = allOut || oversUp;

  const battingList = [...bat.values()].sort((a, b) => a.order - b.order);
  if (striker && nonStriker && !complete) {
    partnerships.push({ batter1: striker, batter2: nonStriker, runs: pRuns, balls: pBalls, unbroken: true });
  }

  return {
    battingTeamId: setup.battingTeamId,
    bowlingTeamId: setup.bowlingTeamId,
    totalRuns: total,
    wickets,
    legalBalls,
    oversText: oversText(legalBalls),
    maxOvers: setup.maxOvers,
    extras,
    strikerId: complete ? null : striker,
    nonStrikerId: complete ? null : nonStriker,
    bowlerId,
    batting: battingList,
    bowling: [...bowl.values()],
    partnerships,
    fallOfWickets: fow,
    currentOver: overSymbols.length > 0 ? overSymbols : (overGroups[overGroups.length - 1] ?? []),
    timeline,
    runRate: legalBalls > 0 ? +((total / legalBalls) * 6).toFixed(2) : 0,
    complete,
  };
}

/** Required run rate for a chase. */
export function requiredRunRate(target: number, scored: number, ballsRemaining: number): number {
  if (ballsRemaining <= 0) return 0;
  return +(((target - scored) / ballsRemaining) * 6).toFixed(2);
}

/** Auto-generated ball commentary (§9.4). Names resolved by the caller. */
export function commentaryLine(e: TimelineEntry, names: Record<string, string>): string {
  const bowler = names[e.bowlerId] ?? 'Bowler';
  const striker = names[e.strikerId] ?? 'Batter';
  const head = `${e.over} ${bowler} to ${striker}, `;

  if (e.wicketType) {
    const out = e.wicketOutId ? names[e.wicketOutId] ?? 'Batter' : striker;
    const how = e.wicketType.replace('_', ' ');
    return `${head}OUT! ${out} ${how}.`;
  }
  if (e.extra === 'wide') return `${head}wide${e.extraRuns ? ` + ${e.extraRuns}` : ''}.`;
  if (e.extra === 'noball') return `${head}no ball${e.runsBat ? `, ${e.runsBat} run(s) off the bat` : ''}.`;
  if (e.extra === 'bye') return `${head}${e.extraRuns} bye(s).`;
  if (e.extra === 'legbye') return `${head}${e.extraRuns} leg bye(s).`;
  if (e.extra === 'penalty') return `${head}${e.extraRuns} penalty run(s).`;
  if (e.runsBat === 0) return `${head}no run.`;
  if (e.runsBat === 4) return `${head}FOUR! Beautifully timed to the boundary.`;
  if (e.runsBat === 6) return `${head}SIX! That's out of here.`;
  return `${head}${e.runsBat} run${e.runsBat > 1 ? 's' : ''}.`;
}

/**
 * Heuristic win probability for the CHASING side (0–100), §8.1 future enhancement.
 * Blends how far ahead/behind the required rate they are with wickets in hand and
 * balls remaining. Not a model — a transparent, monotonic estimate.
 */
export function winProbability(
  target: number, scored: number, wickets: number, ballsRemaining: number, playersPerSide: number,
): number {
  if (scored >= target) return 100;
  if (ballsRemaining <= 0) return 0;
  const wicketsLeft = Math.max(0, playersPerSide - 1 - wickets);
  if (wicketsLeft <= 0) return 0;

  const runsNeeded = target - scored;
  const rrr = (runsNeeded / ballsRemaining) * 6;
  // Chances shrink as the required rate climbs; wickets in hand cushion it.
  const rateScore = Math.max(0, 1 - (rrr - 6) / 12); // 1 at RRR<=6, 0 around RRR=18
  const wicketScore = wicketsLeft / (playersPerSide - 1);
  const p = 100 * (0.7 * rateScore + 0.3 * wicketScore);
  return Math.round(Math.max(1, Math.min(99, p)));
}
