import { describe, it, expect } from 'vitest';
import {
  deriveSubscriptionStatus,
  expiredHours,
  subscriptionSavings,
} from './subscription';

describe('deriveSubscriptionStatus (PRD §9 colours)', () => {
  const s = (over: Partial<Parameters<typeof deriveSubscriptionStatus>[0]> = {}) => ({
    purchasedHours: 20,
    consumedHours: 5,
    daysRemaining: 20,
    started: true,
    ...over,
  });

  it('gray when not started', () => {
    expect(deriveSubscriptionStatus(s({ started: false }))).toBe('gray');
  });
  it('expired when validity elapsed', () => {
    expect(deriveSubscriptionStatus(s({ daysRemaining: -1 }))).toBe('expired');
  });
  it('expired when all hours consumed', () => {
    expect(deriveSubscriptionStatus(s({ consumedHours: 20 }))).toBe('expired');
  });
  it('red when critically low on hours', () => {
    expect(deriveSubscriptionStatus(s({ consumedHours: 18 }))).toBe('red'); // 2h left
  });
  it('red when critically low on days', () => {
    expect(deriveSubscriptionStatus(s({ daysRemaining: 2 }))).toBe('red');
  });
  it('yellow when expiring soon', () => {
    expect(deriveSubscriptionStatus(s({ daysRemaining: 6 }))).toBe('yellow');
  });
  it('green when healthy', () => {
    expect(deriveSubscriptionStatus(s())).toBe('green');
  });
});

describe('expiredHours', () => {
  it('reports unused hours (PRD §10 example: 20 purchased, 16 played -> 4)', () => {
    expect(expiredHours(20, 16)).toBe(4);
  });
  it('never negative', () => {
    expect(expiredHours(20, 25)).toBe(0);
  });
});

describe('subscriptionSavings', () => {
  it('savings = (hourly - sub rate) * hours played', () => {
    // ₹600 vs ₹400 over 16h = ₹3200 (PRD §20 example)
    expect(subscriptionSavings(16, 40000, 60000)).toBe(320000);
  });
});
