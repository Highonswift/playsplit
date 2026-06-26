import { describe, it, expect } from 'vitest';
import { deductHours } from './deduction';
import type { SubscriptionState } from './types';

const sub = (over: Partial<SubscriptionState> = {}): SubscriptionState => ({
  id: 's1',
  ratePerHourPaise: 40000, // ₹400/h
  remainingHours: 10,
  isActive: true,
  ...over,
});

describe('deductHours — dual expiry (PRD §10)', () => {
  it('uses subscription hours when active and available', () => {
    const d = deductHours(120, sub()); // 2h
    expect(d.hoursFromSubscription).toBe(2);
    expect(d.hoursAtHourlyRate).toBe(0);
    expect(d.remainingHoursAfter).toBe(8);
  });

  it('overflows to hourly rate when hours run short', () => {
    const d = deductHours(180, sub({ remainingHours: 1 })); // 3h match, 1h left
    expect(d.hoursFromSubscription).toBe(1);
    expect(d.hoursAtHourlyRate).toBe(2);
    expect(d.remainingHoursAfter).toBe(0);
  });

  it('charges everything hourly when subscription expired by date', () => {
    const d = deductHours(120, sub({ isActive: false }));
    expect(d.hoursFromSubscription).toBe(0);
    expect(d.hoursAtHourlyRate).toBe(2);
  });

  it('charges everything hourly when no remaining hours', () => {
    const d = deductHours(120, sub({ remainingHours: 0 }));
    expect(d.hoursFromSubscription).toBe(0);
    expect(d.hoursAtHourlyRate).toBe(2);
  });

  it('charges everything hourly when there is no subscription', () => {
    const d = deductHours(120, null);
    expect(d.hoursFromSubscription).toBe(0);
    expect(d.hoursAtHourlyRate).toBe(2);
    expect(d.remainingHoursAfter).toBe(0);
  });
});
