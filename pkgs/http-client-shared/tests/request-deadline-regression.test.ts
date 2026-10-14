import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createDeadlineFetch } from '@pkgs/http-client-shared/deadline-fetch';
import { HttpNetworkError } from '@pkgs/http-client-shared/http-network-error';

// regression: stalled-response-keeps-choice-working
test('a stalled mutation transport settles even when it ignores cancellation', async () => {
  const { clock, timers } = createHarnessClock();
  const fetch = createDeadlineFetch({
    fetch: () => new Promise(() => {}),
    timers,
  });
  let outcome: unknown;
  const request = fetch('http://localhost:5428/api/mutations', {
    method: 'POST',
  }).catch((error: unknown) => {
    outcome = error;
  });
  clock.advance(10_000);
  await request;
  expect(outcome).toBeInstanceOf(HttpNetworkError);
});

// regression: stalled-response-keeps-choice-working
test('receiving headers does not leave a stalled response body waiting forever', async () => {
  const { clock, timers } = createHarnessClock();
  let cancelled = false;
  const fetch = createDeadlineFetch({
    timers,
    fetch: async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { 'content-type': 'application/json' } }
      ),
  });
  const response = await fetch('http://localhost:5428/api/query');
  let outcome: unknown;
  const body = response.json().catch((error: unknown) => {
    outcome = error;
  });
  clock.advance(10_000);
  await body;
  expect(outcome).toBeInstanceOf(HttpNetworkError);
  expect(cancelled).toBe(true);
});

test('a healthy response releases its deadline after its body is consumed', async () => {
  const { clock, timers } = createHarnessClock();
  const fetch = createDeadlineFetch({
    timers,
    fetch: async () => new Response('ok'),
  });
  expect(await (await fetch('http://localhost:5428/api/query')).text()).toBe(
    'ok'
  );
  expect(clock.pendingOneShotCount()).toBe(0);
});

test('caller cancellation settles a transport that ignores its signal', async () => {
  const { clock, timers } = createHarnessClock();
  const controller = new AbortController();
  const fetch = createDeadlineFetch({
    timers,
    fetch: () => new Promise(() => {}),
  });
  const result = fetch('http://localhost:5428/api/query', {
    signal: controller.signal,
  }).catch((error: unknown) => error);
  controller.abort();
  expect(((await result) as Error).name).toBe('HttpAbortError');
  expect(clock.pendingOneShotCount()).toBe(0);
});

test('a late response is disposed after the caller has stopped waiting', async () => {
  const { clock, timers } = createHarnessClock();
  let deliver!: (response: Response) => void;
  let cancelled = false;
  const fetch = createDeadlineFetch({
    timers,
    fetch: () =>
      new Promise((resolve) => {
        deliver = resolve;
      }),
  });
  const result = fetch('http://localhost:5428/api/mutations', {
    method: 'POST',
  }).catch((error: unknown) => error);
  clock.advance(10_000);
  expect(await result).toBeInstanceOf(HttpNetworkError);
  deliver(
    new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      })
    )
  );
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
  expect(cancelled).toBe(true);
  expect(clock.pendingOneShotCount()).toBe(0);
});
