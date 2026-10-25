import { expect, test } from 'bun:test';
import { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared-ts/client-storage';
import { createRoomClientPersist } from '@pkgs/room-root-client-ts/room-client-persist';

test('a failed recovery read can be retried without a new queued choice', async () => {
  // regression: client-live-recovery-read-error-blocks-retry
  const errors: unknown[] = [];
  const persist = createRoomClientPersist({
    storage: new InMemoryClientStorage(),
    readQueue: () => [],
    onError: (error) => errors.push(error),
  });
  const failure = new Error('live value temporarily unreadable');
  await expect(
    persist.run(async () => {
      throw failure;
    }, 'read')
  ).rejects.toThrow(failure.message);
  expect(await persist.run(async () => 6, 'read')).toBe(6);
  await persist.flush();
  expect(errors).toEqual([failure]);
});

class FailedQueueStorage extends InMemoryClientStorage {
  fail = true;
  override async saveQueued(
    ...args: Parameters<InMemoryClientStorage['saveQueued']>
  ) {
    if (this.fail) throw new Error('queue write unavailable');
    return super.saveQueued(...args);
  }
}

test('a successful read cannot let a live write pass an unsaved queue', async () => {
  const storage = new FailedQueueStorage();
  const persist = createRoomClientPersist({
    storage,
    readQueue: () => [],
    onError: () => {},
  });
  persist.queueChanged();
  await expect(persist.flush()).rejects.toThrow('queue write unavailable');
  expect(
    await persist.run(() => storage.loadLiveCheckpoint(), 'read')
  ).toBeNull();
  await expect(persist.run(async () => true, 'write')).rejects.toThrow(
    'queue write unavailable'
  );
  storage.fail = false;
  persist.queueChanged();
  await persist.flush();
  expect(await persist.run(async () => true, 'write')).toBe(true);
});
