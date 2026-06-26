import { describe, it, expect } from 'vitest';
import { settleMatch } from './settlement';
import type { PlayerAttendance, SettlementInput, SubscriptionState } from './types';

const HOURLY = 60000; // ₹600/h
const SUB_RATE = 40000; // ₹400/h

const activeSub: SubscriptionState = {
  id: 's1',
  ratePerHourPaise: SUB_RATE,
  remainingHours: 20,
  isActive: true,
};

const player = (id: string, min: number, isInvestor = false): PlayerAttendance => ({
  userId: id,
  billableMinutes: min,
  isInvestor,
});

function base(over: Partial<SettlementInput> = {}): SettlementInput {
  return {
    matchId: 'm1',
    durationMinutes: 120,
    attendance: [player('a', 120), player('b', 120), player('c', 120), player('d', 120)],
    subscription: activeSub,
    ground: { hourlyRatePaise: HOURLY },
    model: 'equal',
    ...over,
  };
}

const sumUsage = (r: ReturnType<typeof settleMatch>) =>
  r.postings.filter((p) => p.type === 'usage').reduce((a, p) => a + p.amountPaise, 0);
const sumReturns = (r: ReturnType<typeof settleMatch>) =>
  r.postings.filter((p) => p.type === 'investor_return').reduce((a, p) => a + p.amountPaise, 0);
const sumCharges = (r: ReturnType<typeof settleMatch>) =>
  r.charges.reduce((a, c) => a + c.amountPaise, 0);

describe('settleMatch — totals & cost derivation', () => {
  it('values subscription hours at the sub rate', () => {
    const r = settleMatch(base());
    expect(r.totalCostPaise).toBe(SUB_RATE * 2); // 2h
    expect(r.deduction.hoursFromSubscription).toBe(2);
    expect(r.deduction.hoursAtHourlyRate).toBe(0);
  });

  it('adds hourly-rate overflow when hours run out', () => {
    const r = settleMatch(base({ subscription: { ...activeSub, remainingHours: 1 } }));
    // 1h @ sub + 1h @ hourly
    expect(r.totalCostPaise).toBe(SUB_RATE * 1 + HOURLY * 1);
  });

  it('charges entirely hourly with no subscription', () => {
    const r = settleMatch(base({ subscription: null }));
    expect(r.totalCostPaise).toBe(HOURLY * 2);
  });
});

describe('Model 1 — Equal split', () => {
  it('splits total evenly and conserves (PRD example shape)', () => {
    const r = settleMatch(base({ model: 'equal' }));
    expect(r.charges.map((c) => c.amountPaise)).toEqual([20000, 20000, 20000, 20000]);
    expect(sumCharges(r)).toBe(r.totalCostPaise);
  });

  it('matches the PRD ₹8000 / 10 players = ₹800 each example', () => {
    const ten = Array.from({ length: 10 }, (_, i) => player(`p${i}`, 60));
    // Force totalCost to ₹8000 via a no-subscription 10h... simpler: hourly rate so 80000/?
    // Use a sub rate that yields ₹8000 for the match duration.
    const r = settleMatch({
      matchId: 'mPRD',
      durationMinutes: 60,
      attendance: ten,
      subscription: { id: 's', ratePerHourPaise: 800000, remainingHours: 5, isActive: true },
      ground: { hourlyRatePaise: 800000 },
      model: 'equal',
    });
    expect(r.totalCostPaise).toBe(800000); // ₹8000
    expect(r.charges.every((c) => c.amountPaise === 80000)).toBe(true); // ₹800
  });
});

describe('Model 2 — Usage-based', () => {
  it('charges proportional to billable minutes and conserves', () => {
    const r = settleMatch({
      ...base({
        model: 'usage',
        durationMinutes: 240, // 4h
        subscription: { ...activeSub, remainingHours: 20 },
        attendance: [player('a', 240), player('b', 180), player('c', 60)],
      }),
    });
    // total = 4h * 400 = ₹1600 = 160000 paise, weights 240:180:60
    expect(r.totalCostPaise).toBe(160000);
    expect(sumCharges(r)).toBe(160000);
    const [a, b, c] = r.charges.map((x) => x.amountPaise);
    expect(a).toBeGreaterThan(b!);
    expect(b!).toBeGreaterThan(c!);
  });
});

describe('Model 3 — Investor', () => {
  it('occasional pay hourly, investors recover the premium', () => {
    const r = settleMatch(
      base({
        model: 'investor',
        attendance: [
          player('inv1', 120, true),
          player('inv2', 120, true),
          player('occ1', 120, false),
          player('occ2', 120, false),
        ],
      }),
    );
    const byId = Object.fromEntries(r.charges.map((c) => [c.userId, c.amountPaise]));
    // occasional: 2h * ₹600 = ₹1200 = 120000
    expect(byId.occ1).toBe(120000);
    expect(byId.occ2).toBe(120000);
    // investors: 2h * ₹400 = 80000, minus return share of premium pool (80000/2=40000)
    expect(byId.inv1).toBe(40000);
    expect(byId.inv2).toBe(40000);
    // conservation: net = everyone at sub rate = 4 * 80000 = 320000
    expect(sumUsage(r) - sumReturns(r)).toBe(320000);
    expect(sumCharges(r)).toBe(320000);
  });

  it('degrades to all-hourly-equivalent when no investors present', () => {
    const r = settleMatch(
      base({ model: 'investor', attendance: [player('o1', 120), player('o2', 120)] }),
    );
    expect(sumReturns(r)).toBe(0);
    expect(r.charges.every((c) => c.amountPaise === 120000)).toBe(true);
  });
});

describe('Model 4 — Hybrid', () => {
  it('pay-per-use at hourly, investors split equally with premium credit', () => {
    const r = settleMatch(
      base({
        model: 'hybrid',
        attendance: [
          player('inv1', 120, true),
          player('inv2', 120, true),
          player('occ1', 120, false),
          player('occ2', 120, false),
        ],
      }),
    );
    const byId = Object.fromEntries(r.charges.map((c) => [c.userId, c.amountPaise]));
    expect(byId.occ1).toBe(120000);
    expect(byId.inv1).toBe(40000);
    expect(sumCharges(r)).toBe(320000);
  });
});

describe('determinism / idempotency', () => {
  it('produces byte-identical postings on repeat runs', () => {
    const input = base({ model: 'investor' });
    const a = settleMatch(input);
    const b = settleMatch(input);
    expect(b.postings).toEqual(a.postings);
    expect(b.charges).toEqual(a.charges);
    expect(b.explanation).toEqual(a.explanation);
  });
});

describe('explanation', () => {
  it('always includes a total-cost line for dispute elimination', () => {
    const r = settleMatch(base());
    expect(r.explanation.some((l) => l.includes('Total cost'))).toBe(true);
  });
});
