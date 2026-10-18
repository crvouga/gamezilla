// @io-wall-ok — tools composition root.

/**
 * What the deployed database link is, as numbers, and what one request may
 * cost on it. `database-link.ts` imposes the first; the journeys that run
 * through it fail when a request exceeds the second.
 *
 * The session count is Hyperdrive's `origin_connection_limit`
 * (`libs/infra-shared/tofu/modules/database/main.tf`); a test holds the two
 * together. The round trip is what a request pays per statement between the
 * Worker and Postgres. The Worker is placed beside the database
 * (`databasePlacement` in `libs/infra-shared/src/wrangler.ts`), where a
 * statement costs a few milliseconds in all, which is what the link adds:
 * the stack's emulated Postgres already spends more than that executing one on
 * a CI runner, so a longer modelled distance would count the same time twice
 * and fail the journeys' wall-clock windows for a reason production does not
 * have. What the link decides is deterministic: the session pool, and the
 * round trips each request is billed.
 */

export const PRODUCTION_DATABASE = {
  sessions: 10,
  waitMs: 15_000,
  roundTripMs: 3,
} as const;

/**
 * The most one request may ask of the database. Each statement is a round
 * trip, a request that sends many holds a pooled session for all of them, and
 * the pool serves everyone at once. A request over budget starves the others
 * in production even when it passes alone on a laptop.
 */
export const REQUEST_BUDGET = {
  /**
   * Round trips in one request. A healthy request is at most 110, 135 when the
   * client happens to batch several mutations into it; the defects that took
   * Deploy down sent 206 to 277.
   */
  roundTrips: 180,
  /**
   * Round trips inside one transaction, which is how long it keeps a session.
   * A healthy transaction is at most 63; the defects held a session for 141 to
   * 168 consecutive statements.
   */
  roundTripsInOneHold: 100,
} as const;

function describe(bill: ConnectionBill): string {
  return `${String(bill.roundTrips)} round trips, ${String(bill.longestHoldRoundTrips)} in its longest hold (${String(Math.round(bill.longestHoldMs))} ms) — ${bill.statements.map((text) => text.slice(0, 60)).join(' | ')}`;
}

/** Every statement of the costliest requests, in order: what to read to cut a request down. */
export function profileOf(summary: DatabaseLinkSummary, top = 3): string {
  return [...summary.bills]
    .sort((a, b) => b.roundTrips - a.roundTrips)
    .slice(0, top)
    .map(
      (bill) =>
        `${String(bill.roundTrips)} round trips:\n${bill.statements.map((text, at) => `  ${String(at + 1).padStart(3)}  ${text}`).join('\n')}`
    )
    .join('\n\n');
}

export type DatabaseVerdict = {
  readonly ok: boolean;
  /** Why not; empty when ok. */
  readonly violations: readonly string[];
  /** The costliest requests, for the log either way. */
  readonly costliest: readonly string[];
};

/** Whether the requests of one run stayed within what the deployed database allows. */
export function databaseVerdict(summary: DatabaseLinkSummary): DatabaseVerdict {
  const violations: string[] = [];
  if (summary.refused > 0)
    violations.push(
      `${String(summary.refused)} request(s) waited ${String(PRODUCTION_DATABASE.waitMs)} ms for a pooled session and were refused: "Timed out while waiting for an open slot in the pool."`
    );
  for (const bill of summary.bills) {
    if (bill.roundTrips > REQUEST_BUDGET.roundTrips)
      violations.push(
        `a request sent ${String(bill.roundTrips)} statements (budget ${String(REQUEST_BUDGET.roundTrips)}): ${describe(bill)}`
      );
    else if (bill.longestHoldRoundTrips > REQUEST_BUDGET.roundTripsInOneHold)
      violations.push(
        `a request held a pooled session for ${String(bill.longestHoldRoundTrips)} statements (budget ${String(REQUEST_BUDGET.roundTripsInOneHold)}): ${describe(bill)}`
      );
  }
  const costliest = [...summary.bills]
    .sort((a, b) => b.roundTrips - a.roundTrips)
    .slice(0, 8)
    .map(describe);
  return { ok: violations.length === 0, violations, costliest };
}
