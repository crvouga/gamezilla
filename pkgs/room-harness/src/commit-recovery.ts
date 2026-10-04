import { defineAction } from '@pkgs/harness-shared/define-action';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-shared/wire';
import type { RoomCommandPayload } from '@pkgs/room-shared/types';
import type { RoomHarness } from './harness';

export type QueuedRoomChange = {
  readonly person: string;
  readonly id: string;
  readonly payload: RoomCommandPayload;
};

export function pendingRoomChangeIds(
  s: RoomHarness,
  person: string
): readonly string[] {
  const room = s.kit.clients.get(person)?.room();
  if (room === undefined || room === null)
    throw new Error(`No app for ${person}`);
  return room.getPendingQueueIds();
}

/** Commands really queue on each device; their delivery is scheduled independently. */
export const holdRoomChanges = defineAction<RoomHarness, [readonly string[]]>({
  name: 'holdRoomChanges',
  act: (s, people) => {
    for (const person of people) s.kit.net(person).set('hold');
  },
});

export const deliverQueuedRoomChange = defineAction<
  RoomHarness,
  [QueuedRoomChange]
>({
  name: 'deliverQueuedRoomChange',
  act: async (s, change) => {
    await s.kit.server.injectCommand({
      id: change.id,
      identity: change.person,
      payload: change.payload,
    });
  },
});

class InterruptedCommit extends Error {}

/** Stop after atomic persistence but before the maker receives the accepted frame. */
export const stopAsRoomChangeCounts = defineAction<
  RoomHarness,
  [QueuedRoomChange]
>({
  name: 'stopAsRoomChangeCounts',
  act: async (s, change) => {
    const storage = s.kit.storage;
    const original = storage.commitCommand;
    storage.commitCommand = async (topic, id, entries) => {
      await original.call(storage, topic, id, entries);
      throw new InterruptedCommit('room stopped before confirming');
    };
    try {
      await s.kit.server.injectCommand({
        id: change.id,
        identity: change.person,
        payload: change.payload,
      });
    } catch (error) {
      if (!(error instanceof InterruptedCommit)) throw error;
    } finally {
      storage.commitCommand = original;
    }
    await s.kit.serverCrash();
  },
});

/** Catch up the log before its possibly out-of-order acknowledgement. */
export const hearRoomChangeCounted = defineAction<
  RoomHarness,
  [QueuedRoomChange]
>({
  name: 'hearRoomChangeCounted',
  act: async (s, change) => {
    const outcome = await s.kit.storage.getDedupOutcome(s.kit.topic, change.id);
    if (outcome?.kind !== 'committed')
      throw new Error('Change has not counted');
    const device = s.kit.clients.get(change.person);
    if (device === undefined) throw new Error('Missing maker');
    const entries = await s.kit.storage.loadEventsAfter(s.kit.topic, 0);
    device.injectFromServer({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.welcome,
      fromSeq: 0,
      entries,
      lastSeq: entries.at(-1)?.seq ?? 0,
    });
    device.injectFromServer({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.committed,
      commandId: change.id,
      entries: outcome.entries,
    });
    await device.room()?.flushIo();
  },
});

/** The actual accepted command IDs and durable pending queues, normalized by the binding. */
export async function roomChangeReceipts(
  s: RoomHarness,
  changes: Readonly<Record<string, QueuedRoomChange>>
) {
  const counted = new Set<string>();
  const heard = new Set<string>();
  for (const [logicalId, change] of Object.entries(changes)) {
    const outcome = await s.kit.storage.getDedupOutcome(s.kit.topic, change.id);
    if (outcome?.kind === 'committed') counted.add(logicalId);
    if (!pendingRoomChangeIds(s, change.person).includes(change.id))
      heard.add(logicalId);
  }
  return {
    _counted: counted,
    _heard: heard,
    _available: !s.kit.isServerCrashed(),
  };
}
