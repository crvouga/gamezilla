import { assert } from '@pkgs/assert';

/** Max mutation rows accepted per POST /api/mutations. */
export const MAX_MUTATIONS_BATCH = 64;

/** Max concurrent in-flight query HTTP batches per client (subscription runtime). */
export const MAX_IN_FLIGHT_POLLS = 1;

/** Max total rows in a nudge `rows` payload before falling back to checkpoint-only. */
export const MAX_FANOUT_ROWS = 64;

/** Max serialized JSON bytes for nudge `rows` before falling back to checkpoint-only. */
export const MAX_FANOUT_BYTES = 32 * 1024;

assert.ok(MAX_MUTATIONS_BATCH > 0, 'MAX_MUTATIONS_BATCH');
assert.ok(MAX_IN_FLIGHT_POLLS > 0, 'MAX_IN_FLIGHT_POLLS');
assert.ok(MAX_FANOUT_ROWS > 0, 'MAX_FANOUT_ROWS');
assert.ok(MAX_FANOUT_BYTES > 0, 'MAX_FANOUT_BYTES');
