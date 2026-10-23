/**
 * A permission decision said in a decision table's words. The product's
 * denial reasons are machine codes; each table names its refusals in its own
 * context's words, so the mapping is per table and covers only the codes that
 * table's decisions can produce. A code a table has no word for is reported
 * as itself (`unmapped: …`), which never equals a table's reason and so shows
 * up as a disagreement instead of being guessed.
 *
 * The space roles table has two refusals ("only the host", "not in the
 * space") that the product does not tell apart — both are `not_granted` — so
 * it has no reason map and its layers observe the answer alone.
 *
 * For tests and spec bindings only (a `root/` export).
 */

import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import type { DenialReason } from '@pkgs/permissions-shared-ts/policy';

export type ReasonWords = Readonly<Partial<Record<DenialReason, string>>>;

/** `specs/billing/access.dmn`. */
export const ACCESS_REASONS: ReasonWords = {
  requires_account: 'needs an account',
  // The only grant an account or a guest is refused without needing an
  // account is the membership offer while the deployment has no provider.
  not_granted: 'not offered',
};

/** `specs/spaces/hosting-limit.dmn`. */
export const HOSTING_LIMIT_REASONS: ReasonWords = {
  limit_reached: 'hosting limit reached',
};

/** `specs/games/daily-puzzle-limit.dmn`. */
export const DAILY_PUZZLE_LIMIT_REASONS: ReasonWords = {
  quota_exhausted: 'daily puzzle limit reached',
};

export type TableAnswer = {
  readonly answer: 'yes' | 'no';
  readonly reason: string;
};

/** The decision as the table would say it. */
export function tableAnswer(
  decision: Decision,
  words: ReasonWords
): TableAnswer {
  if (decision.allowed) return { answer: 'yes', reason: 'none' };
  const code = decision.reason ?? 'not_granted';
  return { answer: 'no', reason: words[code] ?? `unmapped: ${code}` };
}

/** The decision's answer alone (for tables whose reasons it cannot tell). */
export function answerOnly(decision: Decision): {
  readonly answer: 'yes' | 'no';
} {
  return { answer: decision.allowed ? 'yes' : 'no' };
}
