import { deductHours } from './deduction';
import { runModel, type ModelContext } from './models';
import { formatPaise } from './money';
import type { SettlementInput, SettlementResult } from './types';

/**
 * Settle one match — the spine of PlaySplit (PRD Section 12 workflow).
 *
 * Pure and deterministic: the same input always yields the same postings, which
 * is what lets the server action be idempotent by `match_id` (re-settling a
 * match produces identical postings, so it can reverse-and-repost safely).
 *
 * Pipeline:
 *   1. Deduct subscription hours (dual expiry).
 *   2. Compute total real cost (sub-rate hours + hourly overflow).
 *   3. Split across players by the configured cost model.
 *   4. Emit wallet postings + a human-readable explanation.
 */
export function settleMatch(input: SettlementInput): SettlementResult {
  const { matchId, durationMinutes, attendance, subscription, ground, model } = input;

  // Step 1 — hour deduction.
  const deduction = deductHours(durationMinutes, subscription);

  // Step 2 — total cost. Subscription-covered hours are valued at the sub rate;
  // overflow hours at the ground's standard hourly rate.
  const subRatePerHourPaise = subscription?.ratePerHourPaise ?? ground.hourlyRatePaise;
  const subCost = Math.round(subRatePerHourPaise * deduction.hoursFromSubscription);
  const overflowCost = Math.round(ground.hourlyRatePaise * deduction.hoursAtHourlyRate);
  const totalCostPaise = subCost + overflowCost;

  // Step 3 — split.
  const ctx: ModelContext = {
    attendance,
    totalCostPaise,
    subRatePerHourPaise,
    hourlyRatePaise: ground.hourlyRatePaise,
  };
  const { charges, postings, explanation } = runModel(model, ctx);

  // Step 4 — assemble result with a cost-derivation preamble.
  const preamble: string[] = [
    `Match ${matchId}: ${(durationMinutes / 60).toFixed(2)}h, ${attendance.length} player(s).`,
    deduction.hoursFromSubscription > 0
      ? `${deduction.hoursFromSubscription.toFixed(2)}h from subscription @ ${formatPaise(subRatePerHourPaise)}/h = ${formatPaise(subCost)}.`
      : `No subscription hours used.`,
    deduction.hoursAtHourlyRate > 0
      ? `${deduction.hoursAtHourlyRate.toFixed(2)}h at hourly rate @ ${formatPaise(ground.hourlyRatePaise)}/h = ${formatPaise(overflowCost)}.`
      : `No hourly-rate overflow.`,
    `Total cost: ${formatPaise(totalCostPaise)}.`,
  ];

  return {
    matchId,
    model,
    totalCostPaise,
    deduction,
    charges,
    postings,
    explanation: [...preamble, ...explanation],
  };
}
