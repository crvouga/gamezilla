/**
 * A device far behind catches up in bounded welcome batches, asking for the
 * rest after each. A second answer to the same earlier request (a duplicate
 * welcome from before the device advanced) brings nothing new; it must not
 * throw away what the device already applied.
 */

import { expect, test } from 'bun:test';
import { MAX_WELCOME_ENTRIES_PER_FRAME } from '@pkgs/room-root-shared-ts/bounds';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import { openClient, tallyEntry } from './client-rig';

function batch(fromSeq: number, count: number, lastSeq: number) {
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.welcome,
    fromSeq,
    lastSeq,
    entries: Array.from({ length: count }, (_, i) =>
      tallyEntry(fromSeq + 1 + i, 'bob', 1)
    ),
  };
}

// regression: room-stale-partial-welcome-resets-replica
test('a stale duplicate of a partial welcome leaves the caught-up part and the catch-up goes on', async () => {
  const rig = await openClient();
  rig.transport.connect();
  const total = MAX_WELCOME_ENTRIES_PER_FRAME * 2 + 7;
  const first = batch(0, MAX_WELCOME_ENTRIES_PER_FRAME, total);
  rig.transport.deliver(first);
  expect(rig.room.getLastSeq()).toBe(MAX_WELCOME_ENTRIES_PER_FRAME);
  // The same first batch again, as an answer to the earlier request.
  rig.transport.deliver(first);
  expect(rig.room.getLastSeq()).toBe(MAX_WELCOME_ENTRIES_PER_FRAME);
  rig.transport.deliver(
    batch(MAX_WELCOME_ENTRIES_PER_FRAME, MAX_WELCOME_ENTRIES_PER_FRAME, total)
  );
  rig.transport.deliver(batch(MAX_WELCOME_ENTRIES_PER_FRAME * 2, 7, total));
  expect(rig.room.getLastSeq()).toBe(total);
  expect(rig.errors).toEqual([]);
});
