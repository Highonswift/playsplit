import type { Paise, Minutes } from './money';

/** The four configurable cost-sharing models from the PRD (Section 11). */
export type CostModel = 'equal' | 'usage' | 'investor' | 'hybrid';

/** A player who was present (or partially present) at a match. */
export interface PlayerAttendance {
  userId: string;
  /** Actual minutes played after late-join / early-exit / partial adjustments. */
  billableMinutes: Minutes;
  /** Whether this player is a subscription investor (relevant to investor/hybrid). */
  isInvestor: boolean;
}

/** State of the active subscription at the moment the match is settled. */
export interface SubscriptionState {
  id: string;
  /** Effective subscription rate = plan.cost / plan.includedHours, in paise/hour. */
  ratePerHourPaise: Paise;
  /** Whole/fractional hours still available before this match. */
  remainingHours: number;
  /** True if the subscription has NOT expired by date. */
  isActive: boolean;
}

/** Standard ("rack rate") ground pricing used for overflow and occasional players. */
export interface GroundRates {
  hourlyRatePaise: Paise;
}

/** Everything the engine needs to settle one match. Pure data — no I/O. */
export interface SettlementInput {
  matchId: string;
  durationMinutes: Minutes;
  /** Present players only (RSVP-absent players are excluded upstream). */
  attendance: PlayerAttendance[];
  /** Null when the group has no active subscription (everything at hourly rate). */
  subscription: SubscriptionState | null;
  ground: GroundRates;
  model: CostModel;
}

/** Result of step 1: how the match consumed subscription hours. */
export interface HourDeduction {
  matchHours: number;
  hoursFromSubscription: number;
  hoursAtHourlyRate: number;
  /** subscription remaining hours AFTER this match (>= 0). */
  remainingHoursAfter: number;
}

/** A single explanation line attached to a player's charge. */
export interface ChargeLine {
  label: string;
  /** Signed paise: positive = the player owes more, negative = credit. */
  amountPaise: Paise;
}

/** Net amount a single player owes for this match, with a breakdown. */
export interface PlayerCharge {
  userId: string;
  /** Net owed in paise (debits minus credits). May be 0 or negative. */
  amountPaise: Paise;
  breakdown: ChargeLine[];
}

/**
 * Raw ledger postings to be written to `wallet_transactions`.
 * The server action persists these verbatim inside one transaction.
 */
export interface LedgerPosting {
  userId: string;
  type: 'usage' | 'investor_return';
  /** Always non-negative magnitude; `type` determines debit vs credit. */
  amountPaise: Paise;
}

/** Full, deterministic output of settling a match. */
export interface SettlementResult {
  matchId: string;
  model: CostModel;
  totalCostPaise: Paise;
  deduction: HourDeduction;
  /** Net per-player charges (for display / dashboards). */
  charges: PlayerCharge[];
  /** Raw postings for the wallet ledger (usage debits + investor_return credits). */
  postings: LedgerPosting[];
  /** Human-readable settlement explanation (PRD Section 20 dispute elimination). */
  explanation: string[];
}
