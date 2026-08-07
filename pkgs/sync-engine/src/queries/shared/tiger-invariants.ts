import { assert } from '@pkgs/assert';

/**
 * Named Tiger Style invariants for the local sync stack.
 * Importing this module asserts load-time resource bounds.
 */
import {
  MAX_IN_FLIGHT_POLLS,
  MAX_MUTATIONS_BATCH,
} from '@pkgs/sync-engine/queries/server/bounds';

assert.ok(MAX_MUTATIONS_BATCH <= 128, 'Tiger: mutation batch upper bound');
assert.ok(MAX_IN_FLIGHT_POLLS <= 4, 'Tiger: query batch concurrency upper bound');

export const TIGER_INVARIANTS = [
  'actor-from-session-auth-only',
  'mutation-log-atomicity',
  'seq-monotonicity',
  'merge-single-flight',
  'scope-complete-membership',
  'rebase-keeps-queue-on-throw',
  'optimistic-rebase-until-query-confirms',
  'checkpoint-order',
  'auth-wipe-revoked-only',
  'permanent-vs-transient-verdicts',
  'query-hard-limit-required',
  'registry-duplicate-names-crash',
] as const;

export type TigerInvariant = (typeof TIGER_INVARIANTS)[number];
