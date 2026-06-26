import type { Paise } from './money';

/** Subscription health status colours from PRD Section 9. */
export type SubscriptionStatus = 'green' | 'yellow' | 'red' | 'expired' | 'gray';

export interface SubscriptionSnapshot {
  purchasedHours: number;
  consumedHours: number;
  /** Whole days remaining until validity end (can be negative if past). */
  daysRemaining: number;
  /** Whether the subscription has been activated/started. */
  started: boolean;
}

/**
 * Derive the status colour for a subscription (computed, never hand-set).
 *
 * - gray:    not yet started / inactive
 * - expired: validity elapsed OR all hours consumed
 * - red:     critically low (<= 2 hours OR <= 2 days left)
 * - yellow:  expiring soon (<= 5 hours OR <= 7 days left)
 * - green:   healthy
 */
export function deriveSubscriptionStatus(s: SubscriptionSnapshot): SubscriptionStatus {
  if (!s.started) return 'gray';
  const remainingHours = Math.max(0, s.purchasedHours - s.consumedHours);
  if (s.daysRemaining < 0 || remainingHours <= 0) return 'expired';
  if (remainingHours <= 2 || s.daysRemaining <= 2) return 'red';
  if (remainingHours <= 5 || s.daysRemaining <= 7) return 'yellow';
  return 'green';
}

/**
 * Hours that will be lost if the subscription expires now (PRD Section 10 —
 * "Expired Hours"). Used by reports and the savings/loss analytics.
 */
export function expiredHours(purchasedHours: number, consumedHours: number): number {
  return Math.max(0, purchasedHours - consumedHours);
}

/**
 * Estimated savings from using a subscription vs. paying the hourly rate
 * (PRD Section 20 AI subscription recommendation, computed deterministically).
 */
export function subscriptionSavings(
  consumedHours: number,
  subRatePerHourPaise: Paise,
  hourlyRatePaise: Paise,
): Paise {
  return Math.max(0, Math.round((hourlyRatePaise - subRatePerHourPaise) * consumedHours));
}
