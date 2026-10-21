import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { KvImplInMemory } from '@pkgs/kv-root-shared-ts/impl-in-memory';
import {
  committedSegmentKeyword,
  keyValueRoomClientKeywords,
} from '@pkgs/room-root-client-ts/keys';
import { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import { KeyValueClientRoomStorage } from '@pkgs/room-root-client-ts/storage';
import { AddOne, gameRoomModule } from '@pkgs/room-root-harness-ts/game-room';
import { tallyEntry } from './client-rig';
import { FakeTransport } from './fake-transport';
import { testPorts } from './ports';

export const RECOVERY_QUEUED_ID = 'offline-add-1';
export type CacheDamage = 'broken sequence' | 'malformed envelope';
const ENTRIES = asKeyword('room.client.committed/entries');

/** Real persistent room storage, with one durable offline choice. */
export async function seedCacheRecovery(damage: CacheDamage) {
  const kv = new KvImplInMemory();
  const keys = keyValueRoomClientKeywords('offline-cache-recovery');
  const storage = () =>
    new KeyValueClientRoomStorage(kv, keys.committed, keys.queue);
  const initial = storage();
  await initial.appendCommitted([tallyEntry(1, 'bob', 1)]);
  await initial.saveQueued([
    { id: RECOVERY_QUEUED_ID, ts: 1000, payload: AddOne({}) },
  ]);
  const damageCommitted = async (kind: CacheDamage) => {
    const damaged =
      kind === 'broken sequence'
        ? tallyEntry(5, 'bob', 1)
        : { ...tallyEntry(1, 'bob', 1), event: { type: 'malformed' } };
    await kv.put(committedSegmentKeyword(keys.committed, 0), {
      [ENTRIES]: [damaged],
    });
  };
  await damageCommitted(damage);
  return { storage, damageCommitted };
}

/** Open with virtual ports, then remain offline until the caller connects. */
export async function openCacheRecoveryRoom(
  storage: KeyValueClientRoomStorage
) {
  const transport = new FakeTransport();
  const room = await RoomClient.open({
    topic: 'offline-cache-recovery',
    module: gameRoomModule,
    storage,
    transport,
    identity: 'alice',
    ...testPorts(),
  });
  transport.close();
  return { room, transport, storage };
}
