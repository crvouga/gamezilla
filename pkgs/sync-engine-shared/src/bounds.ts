import { assert } from '@pkgs/assert-root-shared/singleton';

import {
  MAX_FANOUT_BYTES as PROTOCOL_MAX_FANOUT_BYTES,
  MAX_FANOUT_ROWS as PROTOCOL_MAX_FANOUT_ROWS,
  MAX_MUTATIONS_BATCH as PROTOCOL_MAX_MUTATIONS_BATCH,
  MAX_MUTATIONS_BODY_BYTES as PROTOCOL_MAX_MUTATIONS_BODY_BYTES,
  MAX_QUERY_BATCH as PROTOCOL_MAX_QUERY_BATCH,
  MAX_QUERY_BODY_BYTES as PROTOCOL_MAX_QUERY_BODY_BYTES,
} from './v2';

/** Max mutation rows accepted per POST /mutations (protocol v1). */
export const MAX_MUTATIONS_BATCH = PROTOCOL_MAX_MUTATIONS_BATCH;

/** Max bytes of one POST /mutations body. */
export const MAX_MUTATIONS_BODY_BYTES = PROTOCOL_MAX_MUTATIONS_BODY_BYTES;

/** Max queries per POST /query batch. */
export const MAX_QUERY_BATCH = PROTOCOL_MAX_QUERY_BATCH;

/** Max bytes of one POST /query body. */
export const MAX_QUERY_BODY_BYTES = PROTOCOL_MAX_QUERY_BODY_BYTES;

/** Max concurrent in-flight query HTTP batches per client (subscription runtime). */
export const MAX_IN_FLIGHT_POLLS = 1;

/** Max total rows in a push `rows` payload before falling back to checkpoint-only. */
export const MAX_FANOUT_ROWS = PROTOCOL_MAX_FANOUT_ROWS;

/** Max serialized JSON bytes for push `rows` before falling back to checkpoint-only. */
export const MAX_FANOUT_BYTES = PROTOCOL_MAX_FANOUT_BYTES;

assert.ok(MAX_MUTATIONS_BATCH > 0, 'MAX_MUTATIONS_BATCH');
assert.ok(MAX_QUERY_BATCH > 0, 'MAX_QUERY_BATCH');
assert.ok(MAX_MUTATIONS_BODY_BYTES > 0, 'MAX_MUTATIONS_BODY_BYTES');
assert.ok(MAX_QUERY_BODY_BYTES > 0, 'MAX_QUERY_BODY_BYTES');
assert.ok(MAX_IN_FLIGHT_POLLS > 0, 'MAX_IN_FLIGHT_POLLS');
assert.ok(MAX_FANOUT_ROWS > 0, 'MAX_FANOUT_ROWS');
assert.ok(MAX_FANOUT_BYTES > 0, 'MAX_FANOUT_BYTES');
