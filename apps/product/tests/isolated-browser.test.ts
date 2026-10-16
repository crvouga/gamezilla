import { expect, test } from 'bun:test';
import { openIsolatedDevice } from '@apps/product/isolated-browser';
import type { BrowserCall } from '@apps/product/remote-browser-driver';
import type { IsolatedWorker } from '@pkgs/os-server/wall-isolated-worker';

function controlled() {
  let reply: (value: unknown) => void = () => {};
  let error: (message: string) => void = () => {};
  const calls: BrowserCall[] = [];
  let terminated = false;
  let disconnected = 0;
  const process: IsolatedWorker = {
    post: (raw) => {
      const request = raw as { id: number; call?: BrowserCall };
      if (request.call) calls.push(request.call);
      if (
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
