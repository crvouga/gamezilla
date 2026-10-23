/**
 * Error-budget arithmetic, the one place it is written down.
 *
 * An objective with target `t` allows a fraction `1 - t` of events to be
 * bad: its error budget. Burn rate is how many times faster than "exactly
 * the whole budget over the whole window" the budget is being spent:
 *
 *   burn = (bad / total) / (1 - t)
 *
 * A burn of 1 spends the budget just as the window ends; 14.4 held for an
 * hour spends 14.4 / 672 = 2.1 % of a 28-day budget.
 */

import { parseDuration } from './window';

export type Counts = { readonly good: number; readonly total: number };

/** The fraction of events an objective with this target may spend as bad. */
export function errorBudget(target: number): number {
  return 1 - target;
}

/**
 * How many times faster than sustainable the budget is being spent, or
 * `null` when nothing was counted. A target of 1 has no budget: any bad
 * event is an infinite burn.
 */
export function burnRate(counts: Counts, target: number): number | null {
  if (counts.total <= 0) return null;
  const bad = Math.max(0, counts.total - counts.good) / counts.total;
  const budget = errorBudget(target);
  if (budget <= 0) return bad > 0 ? Number.POSITIVE_INFINITY : 0;
  return bad / budget;
}

/**
 * The share of a window's error budget still unspent, negative when
 * overspent (-1.5 is one and a half budgets over). `null` with no events.
 */
export function budgetRemaining(counts: Counts, target: number): number | null {
  const burn = burnRate(counts, target);
  return burn === null ? null : 1 - burn;
}

/**
 * The most a burn rate can be: every event bad. A condition above this can
 * never fire, whatever happens.
 */
export function maxBurnRate(target: number): number {
  const budget = errorBudget(target);
  return budget <= 0 ? Number.POSITIVE_INFINITY : 1 / budget;
}

/**
 * The share of the window's budget a burn of `factor` holding for `lookback`
 * spends. 14.4 over `1h` against `28d` is 0.0214.
 */
export function budgetSpent(input: {
  readonly factor: number;
  readonly lookback: string;
  readonly window: string;
}): number {
  const lookbackMs = parseDuration(input.lookback);
  const windowMs = parseDuration(input.window);
  if (lookbackMs === null || windowMs === null) {
    throw new Error(
      `openslo: bad duration in budgetSpent (${input.lookback}, ${input.window})`
    );
  }
  return (input.factor * lookbackMs) / windowMs;
}
