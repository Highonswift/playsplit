import { allocate, paiseForMinutes, formatPaise, type Paise } from './money';
import type {
  ChargeLine,
  CostModel,
  LedgerPosting,
  PlayerAttendance,
  PlayerCharge,
} from './types';

/** What each model function returns to the orchestrator. */
export interface ModelOutput {
  charges: PlayerCharge[];
  postings: LedgerPosting[];
  explanation: string[];
}

export interface ModelContext {
  attendance: PlayerAttendance[];
  /** Total real cost of the match in paise (sub-rate hours + hourly overflow). */
  totalCostPaise: Paise;
  /** Effective subscription rate (paise/hour). Falls back to hourly when no sub. */
  subRatePerHourPaise: Paise;
  /** Standard ground hourly rate (paise/hour). */
  hourlyRatePaise: Paise;
}

/** Build a simple single-line usage charge for a player. */
function usageCharge(userId: string, amount: Paise, label: string): PlayerCharge {
  return { userId, amountPaise: amount, breakdown: [{ label, amountPaise: amount }] };
}

/** Model 1 — Equal split: total divided evenly across present players. */
function equalSplit(ctx: ModelContext): ModelOutput {
  const players = ctx.attendance;
  const shares = allocate(
    ctx.totalCostPaise,
    players.map(() => 1),
  );
  const charges = players.map((p, i) =>
    usageCharge(p.userId, shares[i]!, `Equal share (1/${players.length})`),
  );
  return {
    charges,
    postings: charges.map((c) => ({ userId: c.userId, type: 'usage', amountPaise: c.amountPaise })),
    explanation: [
      `Equal split: ${formatPaise(ctx.totalCostPaise)} ÷ ${players.length} player(s) = ${formatPaise(shares[0] ?? 0)} each.`,
    ],
  };
}

/** Model 2 — Usage-based: proportional to each player's billable minutes. */
function usageSplit(ctx: ModelContext): ModelOutput {
  const players = ctx.attendance;
  const shares = allocate(
    ctx.totalCostPaise,
    players.map((p) => p.billableMinutes),
  );
  const totalMinutes = players.reduce((a, p) => a + p.billableMinutes, 0);
  const charges = players.map((p, i) =>
    usageCharge(
      p.userId,
      shares[i]!,
      `Usage share (${p.billableMinutes}/${totalMinutes} min)`,
    ),
  );
  return {
    charges,
    postings: charges.map((c) => ({ userId: c.userId, type: 'usage', amountPaise: c.amountPaise })),
    explanation: [
      `Usage-based split of ${formatPaise(ctx.totalCostPaise)} across ${totalMinutes} player-minutes.`,
    ],
  };
}

/**
 * Model 3 — Investor: occasional players pay the standard hourly rate; investors
 * pay the discounted subscription rate for their own play. The premium occasional
 * players pay above the subscription rate is redistributed to investors as
 * `investor_return` credits, proportional to each investor's billable minutes —
 * helping them recover their upfront subscription investment (PRD Section 11).
 */
function investorSplit(ctx: ModelContext): ModelOutput {
  const { attendance, hourlyRatePaise, subRatePerHourPaise } = ctx;
  const investors = attendance.filter((p) => p.isInvestor);
  const occasional = attendance.filter((p) => !p.isInvestor);

  const charges: PlayerCharge[] = [];
  const postings: LedgerPosting[] = [];

  // Occasional players: full hourly rate. Premium above sub-rate feeds the pool.
  let premiumPool = 0;
  for (const p of occasional) {
    const hourly = paiseForMinutes(hourlyRatePaise, p.billableMinutes);
    const subValue = paiseForMinutes(subRatePerHourPaise, p.billableMinutes);
    premiumPool += hourly - subValue;
    charges.push(usageCharge(p.userId, hourly, `Hourly rate (occasional, ${p.billableMinutes} min)`));
    postings.push({ userId: p.userId, type: 'usage', amountPaise: hourly });
  }

  // Investors: subscription rate for own play, then receive a share of the pool.
  const returnShares = allocate(
    premiumPool,
    investors.map((p) => p.billableMinutes),
  );
  investors.forEach((p, i) => {
    const subCost = paiseForMinutes(subRatePerHourPaise, p.billableMinutes);
    const ret = returnShares[i] ?? 0;
    const lines: ChargeLine[] = [
      { label: `Subscription rate (investor, ${p.billableMinutes} min)`, amountPaise: subCost },
    ];
    if (ret !== 0) lines.push({ label: 'Investor return (credit)', amountPaise: -ret });
    charges.push({ userId: p.userId, amountPaise: subCost - ret, breakdown: lines });
    postings.push({ userId: p.userId, type: 'usage', amountPaise: subCost });
    if (ret > 0) postings.push({ userId: p.userId, type: 'investor_return', amountPaise: ret });
  });

  return {
    charges,
    postings,
    explanation: [
      `Investor model: ${occasional.length} occasional player(s) charged hourly, ${investors.length} investor(s) at subscription rate.`,
      `Premium of ${formatPaise(premiumPool)} redistributed to investors by playing time.`,
    ],
  };
}

/**
 * Model 4 — Hybrid: occasional players pay-per-use (hourly), while investors are
 * treated as co-owners who split their collective subscription-rate consumption
 * EQUALLY among present investors, and share the occasional premium pool equally
 * too. Distinct from the investor model's per-minute basis.
 */
function hybridSplit(ctx: ModelContext): ModelOutput {
  const { attendance, hourlyRatePaise, subRatePerHourPaise } = ctx;
  const investors = attendance.filter((p) => p.isInvestor);
  const occasional = attendance.filter((p) => !p.isInvestor);

  const charges: PlayerCharge[] = [];
  const postings: LedgerPosting[] = [];

  let premiumPool = 0;
  let investorSubCostTotal = 0;
  for (const p of occasional) {
    const hourly = paiseForMinutes(hourlyRatePaise, p.billableMinutes);
    const subValue = paiseForMinutes(subRatePerHourPaise, p.billableMinutes);
    premiumPool += hourly - subValue;
    charges.push(usageCharge(p.userId, hourly, `Hourly rate (pay-per-use, ${p.billableMinutes} min)`));
    postings.push({ userId: p.userId, type: 'usage', amountPaise: hourly });
  }
  for (const p of investors) {
    investorSubCostTotal += paiseForMinutes(subRatePerHourPaise, p.billableMinutes);
  }

  // Investors split their collective sub-rate cost EQUALLY, and the premium equally.
  const equalCost = allocate(
    investorSubCostTotal,
    investors.map(() => 1),
  );
  const equalReturn = allocate(
    premiumPool,
    investors.map(() => 1),
  );
  investors.forEach((p, i) => {
    const cost = equalCost[i] ?? 0;
    const ret = equalReturn[i] ?? 0;
    const lines: ChargeLine[] = [
      { label: `Co-owner equal share (1/${investors.length})`, amountPaise: cost },
    ];
    if (ret !== 0) lines.push({ label: 'Investor return (credit)', amountPaise: -ret });
    charges.push({ userId: p.userId, amountPaise: cost - ret, breakdown: lines });
    postings.push({ userId: p.userId, type: 'usage', amountPaise: cost });
    if (ret > 0) postings.push({ userId: p.userId, type: 'investor_return', amountPaise: ret });
  });

  return {
    charges,
    postings,
    explanation: [
      `Hybrid model: ${occasional.length} pay-per-use player(s) at hourly rate; ${investors.length} co-owner investor(s) split ${formatPaise(investorSubCostTotal)} equally.`,
      `Premium of ${formatPaise(premiumPool)} shared equally among investors.`,
    ],
  };
}

const MODELS: Record<CostModel, (ctx: ModelContext) => ModelOutput> = {
  equal: equalSplit,
  usage: usageSplit,
  investor: investorSplit,
  hybrid: hybridSplit,
};

export function runModel(model: CostModel, ctx: ModelContext): ModelOutput {
  return MODELS[model](ctx);
}
