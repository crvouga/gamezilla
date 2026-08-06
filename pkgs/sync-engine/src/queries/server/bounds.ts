import { assert } from '@pkgs/assert';

/** Max mutation rows accepted per POST /api/mutations. */
export const MAX_MUTATIONS_BATCH = 64;

/** Max concurrent in-flight query polls per client (subscription runtime). */
export const MAX_IN_FLIGHT_POLLS = 16;

assert.ok(MAX_MUTATIONS_BATCH > 0, 'MAX_MUTATIONS_BATCH');
assert.ok(MAX_IN_FLIGHT_POLLS > 0, 'MAX_IN_FLIGHT_POLLS');
