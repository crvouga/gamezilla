import { Assert } from '@pkgs/assert-root-shared/assert';
import { isMessageEnvelope } from '@pkgs/message-shared/message';
import { RoomCacheInvalidated } from '@pkgs/room-root-shared/cache-invalidation';
import type { RoomStorage } from '@pkgs/room-root-shared/server-core-storage';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared/types';

const crash: Assert = Assert.crash();

export async function loadRoomSnapshot<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(module: RoomModule<S, C, E, Identity>, storage: RoomStorage, topic: string) {
  const entries = await storage.loadEventsAfter(topic, 0);
  let state = module.initialState();
  for (const entry of entries) {
    crash.ok(
      isMessageEnvelope(entry.event),
      'Tiger: stored room events must be Message envelopes with wire-valid type',
      { event: entry.event }
    );
    if (!RoomCacheInvalidated.is(entry.event))
      state = module.reduce(state, entry.event as E);
  }
  const lastSeq =
    entries.length > 0
      ? entries[entries.length - 1]!.seq
      : await storage.getLastSeq(topic);
  return { state, lastSeq };
}
