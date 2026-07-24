import { describe, it, expect } from 'vitest';
import { computeInnings, commentaryLine, winProbability } from './engine';
import type { Ball, InningsSetup } from './types';

const setup: InningsSetup = {
  battingTeamId: 'BAT', bowlingTeamId: 'BOWL', strikerId: 'A', nonStrikerId: 'B',
  maxOvers: 2, playersPerSide: 11,
};
const names = { A: 'V. Kohli', B: 'R. Sharma', C: 'S. Anand', X: 'J. Bumrah' };
const run = (n: number): Ball => ({ bowlerId: 'X', runsBat: n, extra: null, extraRuns: 0, wicket: null });

describe('timeline & commentary (§9.4)', () => {
  it('produces a timeline entry per delivery with the facing striker', () => {
    const s = computeInnings(setup, [run(1), run(0)]);
    expect(s.timeline).toHaveLength(2);
    expect(s.timeline[0]).toMatchObject({ over: '0.1', strikerId: 'A', bowlerId: 'X', runsBat: 1 });
    // the single rotated strike, so the 2nd ball was faced by B
    expect(s.timeline[1]!.strikerId).toBe('B');
  });

  it('generates readable commentary for runs, boundaries and wickets', () => {
    expect(commentaryLine({ over: '0.1', strikerId: 'A', bowlerId: 'X', runsBat: 4, extra: null, extraRuns: 0 }, names))
      .toBe('0.1 J. Bumrah to V. Kohli, FOUR! Beautifully timed to the boundary.');
    expect(commentaryLine({ over: '0.2', strikerId: 'A', bowlerId: 'X', runsBat: 0, extra: null, extraRuns: 0 }, names))
      .toBe('0.2 J. Bumrah to V. Kohli, no run.');
    expect(commentaryLine({ over: '0.3', strikerId: 'A', bowlerId: 'X', runsBat: 0, extra: 'wide', extraRuns: 0 }, names))
      .toBe('0.3 J. Bumrah to V. Kohli, wide.');
    expect(commentaryLine({ over: '0.4', strikerId: 'A', bowlerId: 'X', runsBat: 0, extra: null, extraRuns: 0, wicketType: 'bowled', wicketOutId: 'A' }, names))
      .toBe('0.4 J. Bumrah to V. Kohli, OUT! V. Kohli bowled.');
  });
});

describe('winProbability (§8.1)', () => {
  it('is 100 once the target is reached and 0 when out of balls', () => {
    expect(winProbability(120, 120, 5, 30, 11)).toBe(100);
    expect(winProbability(120, 100, 5, 0, 11)).toBe(0);
  });
  it('is high when the required rate is gentle with wickets in hand', () => {
    // need 30 off 60 (RRR 3), 8 wickets left
    expect(winProbability(150, 120, 2, 60, 11)).toBeGreaterThan(75);
  });
  it('is low when the required rate is very steep', () => {
    // need 90 off 24 (RRR 22.5)
    expect(winProbability(150, 60, 6, 24, 11)).toBeLessThan(30);
  });
  it('drops to 0 when all out', () => {
    expect(winProbability(150, 100, 10, 12, 11)).toBe(0);
  });
});
