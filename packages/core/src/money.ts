/**
 * Money & integer-allocation primitives.
 *
 * All monetary values in PlaySplit are integer **paise** (1 INR = 100 paise).
 * We never use floating-point rupees for storage or arithmetic results — only
 * for intermediate ratios that immediately get re-quantised to integer paise.
 */

export type Paise = number;
export type Minutes = number;

/** Convert rupees (possibly fractional) to integer paise, rounded to nearest. */
export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

/** Convert paise to a rupee number (for display only). */
export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

/** Format paise as an INR string, e.g. 80000 -> "₹800.00". */
export function formatPaise(paise: Paise): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = abs % 100;
  return `${sign}₹${rupees.toLocaleString('en-IN')}.${p.toString().padStart(2, '0')}`;
}

/**
 * Distribute an integer `total` across N buckets proportional to `weights`,
 * using the **largest-remainder method** so the parts always sum back to
 * exactly `total` (no paise lost or invented).
 *
 * - If all weights are zero (or empty), distributes as equally as possible.
 * - Works for any integer total (including negative, e.g. refunds).
 */
export function allocate(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const safeWeights = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  let weightSum = safeWeights.reduce((a, b) => a + b, 0);

  // Degenerate: no positive weights -> split as evenly as possible.
  if (weightSum === 0) {
    safeWeights.fill(1);
    weightSum = n;
  }

  const sign = total < 0 ? -1 : 1;
  const absTotal = Math.abs(total);

  const exact = safeWeights.map((w) => (absTotal * w) / weightSum);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = absTotal - floors.reduce((a, b) => a + b, 0);

  // Hand out the remaining units to the largest fractional parts first.
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = floors.slice();
  for (let k = 0; k < remainder; k++) {
    const idx = order[k % n]!.i;
    result[idx]!++;
  }

  return result.map((x) => x * sign);
}

/** Round a paise amount derived from a per-minute rate to nearest integer paise. */
export function paiseForMinutes(ratePerHourPaise: Paise, minutes: Minutes): Paise {
  return Math.round((ratePerHourPaise * minutes) / 60);
}
