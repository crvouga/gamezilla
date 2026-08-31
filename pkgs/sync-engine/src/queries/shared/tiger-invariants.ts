import { assert } from '@pkgs/assert';

/**
 * Named Tiger Style invariants for the local sync stack.
 * Importing this module asserts load-time resource bounds.
 */
import {
  MAX_IN_FLIGHT_POLLS,
  MAX_MUTATIONS_BATCH,
  MAX_QUERY_BATCH,
} from './bounds';

assert.ok(MAX_MUTATIONS_BATCH <= 128, 'Tiger: mutation batch upper bound');
assert.ok(MAX_QUERY_BATCH <= 128, 'Tiger: query batch upper bound');
assert.ok(
  MAX_IN_FLIGHT_POLLS <= 4,
  'Tiger: query batch concurrency upper bound'
);

/** Invariants checked by {@link checkClientFrameworkInvariants} in sim/DST. */
export const TIGER_INVARIANTS = [
  'seq-monotonicity',
  'permanent-vs-transient-verdicts',
  'push-seq-monotonic-per-topic',
] as const;

export type TigerInvariant = (typeof TIGER_INVARIANTS)[number];
