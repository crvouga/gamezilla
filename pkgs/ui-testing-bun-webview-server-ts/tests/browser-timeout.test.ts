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
