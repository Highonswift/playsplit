import { describe, it, expect } from 'vitest';
import { computeInnings, oversText, requiredRunRate } from './engine';
import type { Ball, DismissalType, InningsSetup } from './types';

const setup = (over: Partial<InningsSetup> = {}): InningsSetup => ({
  battingTeamId: 'BAT',
  bowlingTeamId: 'BOWL',
  strikerId: 'A',
  nonStrikerId: 'B',
  maxOvers: 2,
  playersPerSide: 11,
  ...over,
});

const run = (n: number, bowlerId = 'X'): Ball => ({ bowlerId, runsBat: n, extra: null, extraRuns: 0, wicket: null });
const wide = (extra = 0, bowlerId = 'X'): Ball => ({ bowlerId, runsBat: 0, extra: 'wide', extraRuns: extra, wicket: null });
const noball = (rb = 0, bowlerId = 'X'): Ball => ({ bowlerId, runsBat: rb, extra: 'noball', extraRuns: 0, wicket: null });
const bye = (n: number, bowlerId = 'X'): Ball => ({ bowlerId, runsBat: 0, extra: 'bye', extraRuns: n, wicket: null });
const wkt = (
  type: DismissalType,
  outEnd: 'striker' | 'nonstriker' = 'striker',
  incoming?: string,
  bowlerId = 'X',
): Ball => ({ bowlerId, runsBat: 0, extra: null, extraRuns: 0, wicket: { type, outEnd, incomingBatterId: incoming } });

describe('oversText', () => {
  it('formats legal balls', () => {
    expect(oversText(0)).toBe('0.0');
    expect(oversText(6)).toBe('1.0');
    expect(oversText(99)).toBe('16.3');
  });
});

describe('runs & strike rotation', () => {
  it('a single rotates strike', () => {
    const s = computeInnings(setup(), [run(1)]);
    expect(s.totalRuns).toBe(1);
    expect(s.strikerId).toBe('B');
    expect(s.nonStrikerId).toBe('A');
    expect(s.batting.find((b) => b.playerId === 'A')!.runs).toBe(1);
  });

  it('a boundary does not rotate and counts fours/sixes', () => {
    const s = computeInnings(setup(), [run(4), run(6)]);
    expect(s.totalRuns).toBe(10);
    expect(s.strikerId).toBe('A');
    const a = s.batting.find((b) => b.playerId === 'A')!;
    expect(a.fours).toBe(1);
    expect(a.sixes).toBe(1);
    expect(a.balls).toBe(2);
    expect(a.strikeRate).toBe(500);
  });

  it('swaps strike at the end of an over', () => {
    const s = computeInnings(setup(), [run(0), run(0), run(0), run(0), run(0), run(0)]);
    expect(s.legalBalls).toBe(6);
    expect(s.oversText).toBe('1.0');
    expect(s.strikerId).toBe('B'); // end-of-over swap
  });
});

describe('extras', () => {
  it('wide adds a run but is not a legal ball', () => {
    const s = computeInnings(setup(), [wide()]);
    expect(s.totalRuns).toBe(1);
    expect(s.extras.wide).toBe(1);
    expect(s.legalBalls).toBe(0);
    expect(s.strikerId).toBe('A');
    expect(s.batting.find((b) => b.playerId === 'A')!.balls).toBe(0);
  });

  it('no-ball adds one plus runs off the bat to the striker', () => {
    const s = computeInnings(setup(), [noball(4)]);
    expect(s.totalRuns).toBe(5);
    expect(s.extras.noball).toBe(1);
    expect(s.legalBalls).toBe(0);
    const a = s.batting.find((b) => b.playerId === 'A')!;
    expect(a.runs).toBe(4);
    expect(s.bowling[0]!.runs).toBe(5); // no-ball + runs off bat charged
  });

  it('byes are legal balls, not charged to the batter or bowler', () => {
    const s = computeInnings(setup(), [bye(2)]);
    expect(s.totalRuns).toBe(2);
    expect(s.extras.bye).toBe(2);
    expect(s.legalBalls).toBe(1);
    expect(s.batting.find((b) => b.playerId === 'A')!.runs).toBe(0);
    expect(s.batting.find((b) => b.playerId === 'A')!.balls).toBe(1);
    expect(s.bowling[0]!.runs).toBe(0);
  });

  it('an odd bye rotates strike', () => {
    const s = computeInnings(setup(), [bye(1)]);
    expect(s.strikerId).toBe('B');
  });
});

describe('wickets', () => {
  it('records a bowled dismissal, credits the bowler, brings in a new batter', () => {
    const s = computeInnings(setup(), [wkt('bowled', 'striker', 'C')]);
    expect(s.wickets).toBe(1);
    const a = s.batting.find((b) => b.playerId === 'A')!;
    expect(a.out).toBe(true);
    expect(a.dismissal).toBe('bowled');
    expect(a.outBowlerId).toBe('X');
    expect(s.bowling[0]!.wickets).toBe(1);
    expect(s.strikerId).toBe('C');
    expect(s.fallOfWickets).toEqual([{ wicketNumber: 1, score: 0, outPlayerId: 'A', over: '0.1' }]);
  });

  it('a run out does not credit the bowler and can dismiss the non-striker', () => {
    const s = computeInnings(setup(), [wkt('run_out', 'nonstriker', 'C')]);
    expect(s.wickets).toBe(1);
    expect(s.bowling[0]!.wickets).toBe(0);
    expect(s.nonStrikerId).toBe('C');
    expect(s.batting.find((b) => b.playerId === 'B')!.out).toBe(true);
  });

  it('is all out when wickets == players - 1', () => {
    const s = computeInnings(setup({ playersPerSide: 2 }), [wkt('bowled', 'striker', undefined)]);
    expect(s.complete).toBe(true);
  });
});

describe('innings completion & rates', () => {
  it('completes when overs are exhausted', () => {
    const s = computeInnings(setup({ maxOvers: 1 }), [
      run(1), run(1), run(1), run(1), run(1), run(1),
    ]);
    expect(s.legalBalls).toBe(6);
    expect(s.complete).toBe(true);
    expect(s.totalRuns).toBe(6);
    expect(s.runRate).toBe(6);
  });

  it('credits a maiden over (no runs charged to the bowler)', () => {
    const s = computeInnings(setup(), [run(0), run(0), run(0), run(0), bye(1), run(0)]);
    // bye run does not count against the bowler, so it stays a maiden
    expect(s.bowling[0]!.maidens).toBe(1);
    expect(s.bowling[0]!.runs).toBe(0);
  });

  it('computes required run rate for a chase', () => {
    expect(requiredRunRate(180, 100, 60)).toBe(8); // 80 off 60 balls
  });
});

describe('conservation & figures', () => {
  it('total equals runs off bat + all extras', () => {
    const s = computeInnings(setup(), [run(4), wide(1), noball(2), bye(3), run(1)]);
    const batRuns = s.batting.reduce((a, b) => a + b.runs, 0);
    expect(batRuns + s.extras.total).toBe(s.totalRuns);
  });

  it('bowler legal balls exclude wides and no-balls', () => {
    const s = computeInnings(setup(), [run(1), wide(), noball(0), run(0)]);
    expect(s.bowling[0]!.legalBalls).toBe(2);
    expect(s.bowling[0]!.wides).toBe(1);
    expect(s.bowling[0]!.noballs).toBe(1);
  });
});
