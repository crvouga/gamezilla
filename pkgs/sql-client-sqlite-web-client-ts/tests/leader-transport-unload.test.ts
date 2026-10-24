import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createLeaderTransport } from '@pkgs/sql-client-sqlite-web-client-ts/db-host-leader';

// regression: sqlite-leader-lock-arrives-after-page-unload
// regression: sqlite-released-page-starts-new-owner
test('a Web Lock granted after unload cannot create a leader or retain the lock', async () => {
  const previousNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator'
  );
  const previousChannel = globalThis.BroadcastChannel;
  let grant: ((lock: Lock) => Promise<void> | undefined) | undefined;
  let created = 0;
  let requests = 0;
  let released = false;
  const locks = {
    request: (
      _name: string,
      _options: unknown,
      callback: (lock: Lock) => Promise<void> | undefined
    ) => {
      requests++;
      grant = callback;
      return Promise.resolve();
    },
  };
  class Channel {
    onmessage: unknown = null;
    postMessage = () => undefined;
    close = () => undefined;
  }
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { locks },
  });
  Reflect.set(globalThis, 'BroadcastChannel', Channel);
  const time = createHarnessClock();
  const transport = createLeaderTransport({
    dbName: 'app',
    tabId: 'old-page',
    timers: time.timers,
    createOwnerRuntime: () => {
      created += 1;
      throw new Error('A departed page tried to open another owner');
    },
  });
  try {
    const pending = transport.connect().catch(() => undefined);
    transport.leaveOnUnload();
    if (grant === undefined)
      throw new Error('The page did not request ownership');
    const lifetime = grant({ name: 'db-owner:app', mode: 'exclusive' });
    void Promise.resolve(lifetime).then(() => {
      released = true;
    });
    await pending;
    expect(created).toBe(0);
    expect(released).toBe(true);
    expect(transport.isOwner()).toBe(false);
    const again = transport.connect().then(
      () => null,
      (error) => error
    );
    expect(requests).toBe(1);
    expect(await again).toBeInstanceOf(Error);
  } finally {
    transport.leaveOnUnload();
    Reflect.set(globalThis, 'BroadcastChannel', previousChannel);
    if (previousNavigator === undefined)
      Reflect.deleteProperty(globalThis, 'navigator');
    else Object.defineProperty(globalThis, 'navigator', previousNavigator);
  }
});
