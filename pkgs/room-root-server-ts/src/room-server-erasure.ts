import { RoomCacheInvalidated } from '@pkgs/room-root-shared-ts/cache-invalidation';
import type { RoomIdentityErasure } from '@pkgs/room-root-shared-ts/room-service';
import type { RoomStorage } from '@pkgs/room-root-shared-ts/server-core-storage';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared-ts/service-identity';
import type { LogEntry } from '@pkgs/room-root-shared-ts/types';

/** Called on the room serial chain; erase and cache invalidation commit atomically. */
export async function eraseRoomIdentity(args: {
  readonly storage: RoomStorage;
  readonly topic: string;
  readonly erasure: RoomIdentityErasure;
  readonly now: number;
  readonly tip: () => Promise<number>;
  readonly committed: (entry: LogEntry) => Promise<void>;
}): Promise<void> {
  const commandId = `erasure:${args.erasure.replacement}`;
  if ((await args.storage.getDedupOutcome(args.topic, commandId)) !== null)
    return;
  const entry: LogEntry = {
    seq: (await args.tip()) + 1,
    event: RoomCacheInvalidated({}),
    ts: args.now,
    actor: { id: ROOM_SERVICE_IDENTITY, clientId: 'service' },
  };
  await args.storage.eraseIdentity(args.topic, args.erasure, {
    commandId,
    entry,
  });
  await args.committed(entry);
}
