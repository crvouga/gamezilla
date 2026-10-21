import { assert } from '@pkgs/assert-root-shared-ts/singleton';

/**
 * Static resource bounds for the room engine (Tiger Style).
 * Over-bound command enqueue / roster / welcome batch → `room.error/rate-limited`
 * or a truncated welcome the client catch-ups via `sync`.
 */

/** Max durable + in-memory outbound commands per client. */
export const MAX_PENDING_OUTBOUND_COMMANDS = 256;

/** Max log entries in a single welcome frame (client re-syncs for the rest). */
export const MAX_WELCOME_ENTRIES_PER_FRAME = 512;

/** Max live connections in a room roster. */
export const MAX_ROSTER_SIZE = 64;

assert.ok(
  MAX_PENDING_OUTBOUND_COMMANDS > 0,
  'Tiger: MAX_PENDING_OUTBOUND_COMMANDS'
);
assert.ok(
  MAX_WELCOME_ENTRIES_PER_FRAME > 0,
  'Tiger: MAX_WELCOME_ENTRIES_PER_FRAME'
);
assert.ok(MAX_ROSTER_SIZE > 0, 'Tiger: MAX_ROSTER_SIZE');
assert.ok(
  MAX_PENDING_OUTBOUND_COMMANDS <= 1024,
  'Tiger: pending outbound upper bound'
);
assert.ok(
  MAX_WELCOME_ENTRIES_PER_FRAME <= 4096,
  'Tiger: welcome batch upper bound'
);
assert.ok(MAX_ROSTER_SIZE <= 256, 'Tiger: roster size upper bound');
