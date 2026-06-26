import { describe, it, expect } from 'vitest';
import { allocate, paiseForMinutes, formatPaise, rupeesToPaise } from './money';

describe('allocate', () => {
  it('splits evenly when weights are equal', () => {
    expect(allocate(900, [1, 1, 1])).toEqual([300, 300, 300]);
  });

  it('never loses or invents paise (largest-remainder)', () => {
    const parts = allocate(1000, [1, 1, 1]); // 333.33 each
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
  });

  it('distributes proportional to weights', () => {
    const parts = allocate(80000, [20, 15, 5]); // 50%, 37.5%, 12.5%
    expect(parts.reduce((a, b) => a + b, 0)).toBe(80000);
    expect(parts).toEqual([40000, 30000, 10000]);
  });

  it('handles all-zero weights by splitting evenly', () => {
    const parts = allocate(100, [0, 0, 0]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('handles negative totals (refunds) and conserves', () => {
    const parts = allocate(-1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(-1000);
  });

  it('returns empty for no buckets', () => {
    expect(allocate(100, [])).toEqual([]);
  });
});

describe('paiseForMinutes', () => {
  it('computes a per-minute slice of an hourly rate', () => {
    expect(paiseForMinutes(60000, 60)).toBe(60000); // 1h
    expect(paiseForMinutes(60000, 30)).toBe(30000); // 30m
    expect(paiseForMinutes(60000, 90)).toBe(90000); // 1.5h
  });
});

describe('formatPaise', () => {
  it('formats INR with paise', () => {
    expect(formatPaise(80000)).toBe('₹800.00');
    expect(formatPaise(80050)).toBe('₹800.50');
    expect(formatPaise(-1500)).toBe('-₹15.00');
  });
});

describe('rupeesToPaise', () => {
  it('rounds to nearest paise', () => {
    expect(rupeesToPaise(800)).toBe(80000);
    expect(rupeesToPaise(12.345)).toBe(1235);
  });
});
