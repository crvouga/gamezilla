import { expect, test } from 'bun:test';
import type { IsolatedWorker } from '@pkgs/os-server-ts/wall-isolated-worker';
import { createIsolatedBrowserProcess } from '@pkgs/ui-testing-bun-webview-server-ts/wall-io';
import { ElementNotFoundError } from '@pkgs/ui-testing-root-shared-ts/element-not-found-error';

function worker() {
  let receive: (value: unknown) => void = () => {};
  const requests: unknown[] = [];
  let terminations = 0;
  const process: IsolatedWorker = {
    post: (raw) => {
      requests.push(raw);
      const request = raw as { id: number; call?: { method: string } };
      receive({
        id: request.id,
        value: request.call?.method === 'screenshot' ? 'iVBORw==' : true,
      });
    },
    subscribe: (listener) => {
      receive = listener;
      return () => {};
    },
    onError: () => () => {},
    terminate: () => {
      terminations += 1;
    },
  };
  return { process, requests, terminations: () => terminations };
}

// regression: stack-browser-profile-cross-device-authentication
test('each fresh Alice device owns a process; reopening keeps only its own profile', async () => {
  const workers: ReturnType<typeof worker>[] = [];
  const spawn = () => {
    const child = worker();
    workers.push(child);
    return child.process;
  };
  const first = {
    webOrigin: 'http://127.0.0.1:34305',
    actorId: 'alice',
    dataStore: { directory: '/devices/first-alice' },
  };
  const fresh = { ...first, dataStore: { directory: '/devices/fresh-alice' } };
  const firstProcess = createIsolatedBrowserProcess(spawn);
  const freshProcess = createIsolatedBrowserProcess(spawn);
  const alice = await firstProcess.open(first);
  const another = await freshProcess.open(fresh);
  await alice.view.evaluate(
    "localStorage.setItem('identity', 'alice.559006d7@gmail.com')"
  );
  await another.driver.get('account-sign-in').isVisible();
  await alice.close();
  await alice.close();
  const reopened = await firstProcess.open(first);
  expect(workers).toHaveLength(2);
  expect(
    workers.map((child) =>
      child.requests
        .filter((request) => 'open' in (request as object))
        .map((request) => (request as { open: unknown }).open)
    )
  ).toEqual([[first, first], [fresh]]);
  expect(workers[0]?.terminations()).toBe(0);
  expect(workers[1]?.terminations()).toBe(0);
  await reopened.close();
  await another.close();
  await firstProcess.close();
  await freshProcess.close();
  expect(workers.map((child) => child.terminations())).toEqual([1, 1]);
});

test('the isolated native facade retains resize and screenshot bytes', async () => {
  const child = worker();
  const process = createIsolatedBrowserProcess(() => child.process);
  const browser = await process.open({
    webOrigin: 'http://localhost',
    dataStore: { directory: '/device' },
  });
  await browser.view.resize(768, 1024);
  expect(child.requests.at(-1)).toMatchObject({
    call: { target: 'view', method: 'resize', args: [768, 1024] },
  });
  expect(await browser.view.screenshot({ encoding: 'buffer' })).toEqual(
    Buffer.from([137, 80, 78, 71])
  );
  await browser.close();
  await process.close();
});

test('device cleanup waits for the owned process to exit', async () => {
  const child = worker();
  const exit = Promise.withResolvers<void>();
  child.process.terminate = () => exit.promise;
  const device = createIsolatedBrowserProcess(() => child.process);
  let closed = false;
  const closing = device.close().then(() => {
    closed = true;
  });
  await Promise.resolve();
  expect(closed).toBe(false);
  exit.resolve();
  await closing;
  expect(closed).toBe(true);
});

// regression: browser-process-error-class-lost
test('a missing element in the browser process is still an ElementNotFoundError', async () => {
  const child = worker();
  const post = child.process.post;
  let receive: (value: unknown) => void = () => {};
  const subscribe = child.process.subscribe;
  child.process.subscribe = (listener) => {
    receive = listener;
    return subscribe(listener);
  };
  child.process.post = (raw) => {
    const request = raw as { id: number; call?: { method: string } };
    if (request.call?.method !== 'text') return post(raw);
    receive({
      id: request.id,
      error: 'Element not found: testId("custom-game-debug")',
      errorName: 'ElementNotFoundError',
    });
  };
  const process = createIsolatedBrowserProcess(() => child.process);
  const browser = await process.open({
    webOrigin: 'http://localhost',
    dataStore: { directory: '/device' },
  });
  const missing = await browser.driver
    .get('custom-game-debug')
    .text()
    .catch((error: unknown) => error);
  expect(missing).toBeInstanceOf(ElementNotFoundError);
  expect((missing as Error).name).toBe('ElementNotFoundError');
  expect((missing as Error).message).toContain('custom-game-debug');
  await browser.close();
  await process.close();
});
