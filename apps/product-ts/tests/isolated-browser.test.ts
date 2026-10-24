import { expect, test } from 'bun:test';
import { openIsolatedDevice } from '@apps/product-ts/isolated-browser';
import {
  actOnLiveDevice,
  type LiveDevices,
  openGuestDevice,
  runLiveCleanups,
} from '@apps/product-ts/live-journey-devices';
import type { BrowserCall } from '@apps/product-ts/remote-browser-driver';
import type { IsolatedWorker } from '@pkgs/os-server-ts/wall-isolated-worker';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

// regression: live-guest-clears-host-storage
test('a link guest uses an isolated process and keeps it across navigations', async () => {
  const worker = controlled();
  const target = {
    webOrigin: 'https://web.example',
    apiOrigin: 'https://api.example',
    oauthCallbackOrigin: 'https://api.example',
    http: {
      fetch: async () => {
        throw new Error('unexpected HTTP');
      },
    },
  };
  let opened = 0;
  const devices: LiveDevices = { host: null, guest: null, shown: null };
  const open = async () => {
    opened++;
    return openIsolatedDevice(target, () => worker.process);
  };
  try {
    await openGuestDevice(target, devices, '/space/one', open);
    await openGuestDevice(target, devices, '/space/two', open);
    expect(opened).toBe(1);
    expect(devices.shown).toBe(devices.guest);
    expect(worker.calls.map((call) => call.args)).toEqual([
      ['https://web.example/space/one'],
      ['https://web.example/space/two'],
    ]);
  } finally {
    await devices.guest?.close();
  }
});

function controlled(
  focus?: { activate(): void; interact(): void },
  refusal?: (call: BrowserCall) => string | undefined
) {
  let reply: (value: unknown) => void = () => {};
  let error: (message: string) => void = () => {};
  const calls: BrowserCall[] = [];
  let terminated = false;
  let disconnected = 0;
  const process: IsolatedWorker = {
    post: (raw) => {
      const request = raw as { id: number; call?: BrowserCall };
      if (request.call) {
        calls.push(request.call);
        if (request.call.target === 'node') focus?.interact();
        if (
          request.call.target === 'view' &&
          request.call.args[0] === 'Page.bringToFront'
        )
          focus?.activate();
      }
      const refused =
        request.call === undefined ? undefined : refusal?.(request.call);
      if (refused !== undefined) reply({ id: request.id, error: refused });
      else if (
        request.call?.method === 'evaluate' &&
        request.call.args[0] === 'fail'
      )
        error('The browser exited');
      else
        reply({
          id: request.id,
          value: request.call?.method === 'text' ? 'A real disc' : true,
          network: [
            '{"event":"request","url":"https://api.example/api/health"}',
          ],
        });
    },
    subscribe: (listener) => {
      reply = listener;
      return () => {
        disconnected++;
      };
    },
    onError: (listener) => {
      error = listener;
      return () => {
        disconnected++;
      };
    },
    terminate: () => {
      terminated = true;
    },
  };
  return {
    process,
    calls,
    terminated: () => terminated,
    disconnected: () => disconnected,
  };
}

// regression: isolated-browser-failure-loses-gesture
test('journey diagnostics retain a remote failure’s method and control without arguments', async () => {
  const worker = controlled(undefined, (call) =>
    call.method === 'expect.text' ? 'Timed out waiting for text' : undefined
  );
  const device = await openIsolatedDevice(
    { webOrigin: 'https://web.example', apiOrigin: 'https://api.example' },
    () => worker.process
  );
  try {
    const message = String(
      await device.driver
        .get('custom-game')
        .get('custom-game-black-release')
        .expect.text('private argument', { timeoutMs: 20000 })
        .catch(String)
    );
    expect(message).toContain(
      'node custom-game/custom-game-black-release expect.text'
    );
    expect(message).toContain('Timed out waiting for text');
    expect(message).not.toContain('private argument');
    expect(message).not.toContain('20000');
  } finally {
    await device.close();
  }
});
// regression: isolated-browser-optional-gesture-arguments
test('isolated devices preserve scoped gestures and release their process on close', async () => {
  const worker = controlled();
  const device = await openIsolatedDevice(
    { webOrigin: 'https://web.example', apiOrigin: 'https://api.example' },
    () => worker.process
  );
  await device.driver.get('board').get('column-2').tap();
  expect(device.apiOrigin).toBe('https://api.example');
  expect(device.network).toEqual([
    '{"event":"request","url":"https://api.example/api/health"}',
  ]);
  expect(await device.driver.get('disc').text()).toBe('A real disc');
  await device.driver.get('result').expect.visible({ timeoutMs: 2000 });
  expect(worker.calls[0]).toEqual({
    target: 'node',
    path: ['board', 'column-2'],
    method: 'tap',
    args: [],
  });
  expect(worker.calls.at(-1)?.method).toBe('expect.visible');
  await device.close();
  expect(worker.terminated()).toBe(true);
  expect(worker.disconnected()).toBe(2);
});
test('a failed isolated browser rejects pending work and still tears down', async () => {
  const worker = controlled();
  const device = await openIsolatedDevice(
    { webOrigin: 'https://web.example', apiOrigin: 'https://api.example' },
    () => worker.process
  );
  await expect(device.view.evaluate('fail')).rejects.toThrow(
    'The browser exited'
  );
  await device.close();
  expect(worker.terminated()).toBe(true);
});

// regression: isolated-browser-file-selection
test('isolated devices forward file contents to the selected input', async () => {
  const worker = controlled();
  const device = await openIsolatedDevice(
    { webOrigin: 'https://web.example', apiOrigin: 'https://api.example' },
    () => worker.process
  );
  const file = { name: 'puzzles.csv', bytes: [73, 100, 10] };
  await device.driver.get('settings').get('source').selectFile(file);
  expect(worker.calls.at(-1)).toEqual({
    target: 'node',
    path: ['settings', 'source'],
    method: 'selectFile',
    args: [file],
  });
  await device.close();
});

async function switchDevices(order: readonly boolean[]): Promise<number> {
  let active = 1;
  let reads = 0;
  const workers = [0, 1].map((id) =>
    controlled({
      activate: () => {
        active = id;
      },
      interact: () => {
        expect(active).toBe(id);
        reads++;
      },
    })
  );
  const target = {
    webOrigin: 'https://web.example',
    apiOrigin: 'https://api.example',
  };
  const host = await openIsolatedDevice(target, () => workers[0]!.process);
  const peer = await openIsolatedDevice(target, () => workers[1]!.process);
  const devices: LiveDevices = { host, guest: peer, shown: peer };
  try {
    for (const second of order)
      await actOnLiveDevice(devices, second ? peer : host, async (ui) => {
        expect(await ui.get('multiplayer-game').text()).toBe('A real disc');
      });
    return reads;
  } finally {
    await host.close();
    await peer.close();
  }
}

// regression: live-journey-background-device
test('returning from the peer activates the host before observing or playing its game', async () => {
  expect(await switchDevices([false, true, false])).toBe(3);
});

test('every device switch activates the selected person before reading their page', async () => {
  await assertProperty(
    'live journey device activation',
    fc.asyncProperty(
      fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
      async (order) => {
        expect(await switchDevices(order)).toBe(order.length);
      }
    )
  );
});

// regression: live-cleanup-on-background-device
test('cleanups after the peer acted last run on the activated host page', async () => {
  let active = 1;
  let reads = 0;
  const workers = [0, 1].map((id) =>
    controlled({
      activate: () => {
        active = id;
      },
      interact: () => {
        expect(active).toBe(id);
        reads++;
      },
    })
  );
  const target = {
    webOrigin: 'https://web.example',
    apiOrigin: 'https://api.example',
  };
  const host = await openIsolatedDevice(target, () => workers[0]!.process);
  const peer = await openIsolatedDevice(target, () => workers[1]!.process);
  const devices: LiveDevices = { host, guest: peer, shown: peer };
  const failures: string[] = [];
  try {
    const failure = await runLiveCleanups(
      devices,
      new Map([
        [
          'first',
          async (ui) => {
            await ui.get('multiplayer-game').text();
            throw new Error('first cleanup failed');
          },
        ],
        [
          'second',
          async (ui) => {
            await ui.get('multiplayer-game').text();
          },
        ],
      ]),
      (key) => failures.push(key)
    );
    expect(reads).toBe(2);
    expect(failures).toEqual(['first']);
    expect(String(failure)).toContain('first cleanup failed');
  } finally {
    await host.close();
    await peer.close();
  }
});
