import type { HourDeduction, SubscriptionState } from './types';
import type { Minutes } from './money';

/**
 * Step 1 of the settlement pipeline — subscription hour deduction.
 *
 * Dual expiry per PRD Section 10: a subscription is usable only while it is
 * BOTH active by date (`isActive`) AND has `remainingHours > 0`. Any match time
 * beyond the remaining hours (or when there is no usable subscription) overflows
 * to the ground's standard hourly rate.
 */
export function deductHours(
  durationMinutes: Minutes,
  subscription: SubscriptionState | null,
): HourDeduction {
  const matchHours = durationMinutes / 60;

  const usable =
    subscription !== null && subscription.isActive && subscription.remainingHours > 0;

  if (!usable) {
    return {
      matchHours,
      hoursFromSubscription: 0,
      hoursAtHourlyRate: matchHours,
      remainingHoursAfter: subscription ? Math.max(0, subscription.remainingHours) : 0,
    };
  }

  const hoursFromSubscription = Math.min(matchHours, subscription!.remainingHours);
  const hoursAtHourlyRate = matchHours - hoursFromSubscription;

  return {
    matchHours,
    hoursFromSubscription,
    hoursAtHourlyRate,
    remainingHoursAfter: subscription!.remainingHours - hoursFromSubscription,
  };
}
