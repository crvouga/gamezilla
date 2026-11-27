import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { IsolatedWorker } from '@pkgs/os-server-ts/wall-isolated-worker';
import { browserProcessChannel } from '@pkgs/ui-testing-bun-webview-server-ts/browser-process-channel';

function fixture() {
  const time = createHarnessClock();
  let receive: (value: unknown) => void = () => {};
  const worker: IsolatedWorker = {
    post: () => {},
    subscribe: (listener) => {
      receive = listener;
      return () => {};
    },
    onError: () => () => {},
    terminate: () => {},
  };
  return {
    ...time,
    channel: browserProcessChannel(worker, time.timers),
    receive: (value: unknown) => receive(value),
  };
}

// regression: isolated-browser-timeout-loses-command
test('a stalled card input retains command and last stage without its typed value', async () => {
  const f = fixture();
  const result = f.channel
    .request({
      call: {
        target: 'node',
        path: ['stripe-mock-card'],
        method: 'input',
        args: ['4242424242424242', { timeoutMs: 20_000 }],
      },
    })
    .catch((error: unknown) => error);
  f.receive({ id: 1, stage: 'executing' });
  f.clock.advance(20_000);
  expect(f.clock.pendingOneShotCount()).toBe(1);
  f.clock.advance(70_000);
  const error = await result;
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(
    'node stripe-mock-card input: The isolated browser did not answer after 90000ms (stage: executing)'
  );
  expect((error as Error).message).not.toContain('4242424242424242');
  expect(f.clock.pendingOneShotCount()).toBe(0);
  await f.channel.close();
});

test('progress neither completes a request nor extends its deadline', async () => {
  const f = fixture();
  const result = f.channel
    .request({ open: { secret: 'credential' } })
    .catch((error: unknown) => error);
  f.clock.advance(89_000);
  f.receive({ id: 1, stage: 'opening' });
  f.clock.advance(1_000);
  expect(((await result) as Error).message).toBe(
    'The isolated browser did not answer after 90000ms (stage: opening)'
  );
  await f.channel.close();
});

// regression: isolated-tap-timeout-loses-native-operation
test('a stuck Google tap retains the last native operation at the original deadline', async () => {
  const f = fixture();
  const result = f.channel.request({
    call: {
      target: 'node',
      path: ['auth-method-google'],
      method: 'tap',
      args: [],
    },
  });
  const failed = result.catch((error: unknown) => error);
  f.clock.advance(89_000);
  f.receive({
    id: 1,
    stage: 'executing',
    operation: 'opener.click #8 at native-click.ts:155',
  });
  f.clock.advance(1_000);
  expect(((await failed) as Error).message).toContain(
    'stage: executing; opener.click #8 at native-click.ts:155'
  );
  await f.channel.close();
});

test('a reply after progress completes normally and clears the deadline', async () => {
  const f = fixture();
  const result = f.channel.request({ open: {} });
  f.receive({ id: 1, stage: 'opening' });
  f.receive({ id: 1, value: true });
  expect(await result).toBe(true);
  expect(f.clock.pendingOneShotCount()).toBe(0);
  await f.channel.close();
});

test('an unacknowledged request identifies the transport stage', async () => {
  const f = fixture();
  const result = f.channel
    .request({ open: {} })
    .catch((error: unknown) => error);
  f.clock.advance(90_000);
  expect(((await result) as Error).message).toContain('stage: sent');
  await f.channel.close();
});

// regression: isolated-browser-stuck-call-cascades
test('after a call is stuck in the browser, later page calls fail at once naming it', async () => {
  const f = fixture();
  const tap = f.channel
    .request({
      call: {
        target: 'node',
        path: ['auth-method-google'],
        method: 'tap',
        args: [],
      },
    })
    .catch((error: unknown) => error);
  f.receive({ id: 1, stage: 'executing' });
  f.clock.advance(90_000);
  await tap;

  const probe = await f.channel
    .request({
      call: {
        target: 'node',
        path: ['search-loading'],
        method: 'isVisible',
        args: [],
      },
    })
    .catch((error: unknown) => error);
  expect((probe as Error).message).toBe(
    'node search-loading isVisible: The isolated browser is still running node auth-method-google tap, which did not answer after 90000ms'
  );
  expect(f.clock.pendingOneShotCount()).toBe(0);

  // The URL is read without page code, so it is still asked.
  const url = f.channel.request({
    call: { target: 'view', path: [], method: 'loadedUrl', args: [] },
  });
  f.receive({ id: 2, value: 'http://127.0.0.1:33333/' });
  expect(await url).toBe('http://127.0.0.1:33333/');

  // Once the stuck call answers, the browser takes page calls again.
  f.receive({ id: 1, value: undefined });
  const next = f.channel.request({
    call: { target: 'node', path: ['x'], method: 'isVisible', args: [] },
  });
  f.receive({ id: 3, value: true });
  expect(await next).toBe(true);
  await f.channel.close();
});

// regression: provider-marker-opener-evaluation
test('a pending chooser probe uses the remaining provider deadline', async () => {
  const f = fixture();
  const call = {
    target: 'document-node',
    path: ['oauth-mock-chooser'],
    method: 'isVisible',
    args: [],
  } as const;
  const result = f.channel
    .request({ call }, 1250)
    .catch((cause: Error) => cause.message);
  f.receive({
    id: 1,
    stage: 'executing',
    operation: 'opener.evaluate #1 pending',
  });
  f.clock.advance(1249);
  expect(f.clock.pendingOneShotCount()).toBe(1);
  f.clock.advance(1);
  expect(f.clock.pendingOneShotCount()).toBe(0);
  expect(await result).toContain(
    '1250ms (stage: executing; opener.evaluate #1 pending)'
  );
  await expect(f.channel.request({ call })).rejects.toThrow(
    'did not answer after 1250ms'
  );
  await f.channel.close();
});
