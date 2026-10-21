import { expect, test } from 'bun:test';
import { createHarnessLoadBalancer } from '@libs/harness-ts/load-balancer';
import { createHarnessNet } from '@libs/harness-ts/net';

async function flush(): Promise<void> {
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
}

test('a held mutation does not run before acceptance and does not hold health reads', async () => {
  const net = createHarnessNet();
  let mutations = 0;
  let reads = 0;
  const fetch = net.wrapHop('alice', 'server', async (_input, init) => {
    if (init?.method === 'POST') mutations++;
    else reads++;
    return new Response(null, { status: 200 });
  });
  net.holdHttp('alice', '/api/mutations');
  const request = fetch('https://app.example/api/mutations', {
    method: 'POST',
  });
  await flush();
  expect(mutations).toBe(0);
  expect((await fetch('https://app.example/api/health')).status).toBe(200);
  expect(reads).toBe(1);
  net.releaseHttp('alice', '/api/mutations');
  expect((await request).status).toBe(200);
  expect(mutations).toBe(1);
});

test('a lost answer can follow an accepted write and cancellation releases its response', async () => {
  const net = createHarnessNet();
  let accepted = 0;
  let cancelled = false;
  const fetch = net.wrapHop('alice', 'server', async () => {
    accepted++;
    return new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      })
    );
  });
  const barrier = net.holdHttp('alice', '/api/mutations');
  const controller = new AbortController();
  let answered = false;
  const request = fetch('https://app.example/api/mutations', {
    method: 'POST',
    signal: controller.signal,
  }).then(
    () => {
      answered = true;
    },
    (error: unknown) => error
  );
  barrier.acceptWithoutAnswer();
  await flush();
  expect(accepted).toBe(1);
  expect(answered).toBe(false);
  controller.abort();
  expect(await request).toMatchObject({ name: 'HttpAbortError' });
  expect(cancelled).toBe(true);
  net.releaseHttp('alice', '/api/mutations');
  expect(accepted).toBe(1);
});

test('restoring a held request cannot deliver an already-aborted write', async () => {
  const net = createHarnessNet();
  let accepted = 0;
  const fetch = net.wrapHop('alice', 'server', async () => {
    accepted++;
    return new Response(null);
  });
  net.holdHttp('alice', '/api/mutations');
  const controller = new AbortController();
  const request = fetch('https://app.example/api/mutations', {
    method: 'POST',
    signal: controller.signal,
  }).catch((error: unknown) => error);
  controller.abort();
  net.releaseHttp('alice', '/api/mutations');
  expect(await request).toMatchObject({ name: 'HttpAbortError' });
  expect(accepted).toBe(0);
});

test('a fully admitted write may finish after the client closes and loses its path', async () => {
  // regression: admitted-write-dies-with-client
  const net = createHarnessNet();
  let accepted: unknown = null;
  const fetch = net.wrapHop('alice', 'server', async (input, init) => {
    const request = new Request(input, init);
    accepted = await request.json();
    return new Response(null);
  });
  const barrier = net.holdHttp('alice', '/api/mutations', { admitted: true });
  const controller = new AbortController();
  const request = fetch('https://app.example/api/mutations', {
    method: 'POST',
    body: '{"spaceId":"evening-chess"}',
    signal: controller.signal,
  }).catch((error: unknown) => error);
  await flush();
  expect(barrier.requestsStarted()).toBe(1);
  controller.abort();
  expect(await request).toMatchObject({ name: 'HttpAbortError' });
  net.partition('alice', 'server');
  barrier.acceptWithoutAnswer();
  await flush();
  expect(accepted).toEqual({ spaceId: 'evening-chess' });
  net.releaseHttp('alice', '/api/mutations');
});

test('a load-balanced admission owns its chosen backend before client-path loss', async () => {
  // regression: admitted-write-dies-with-client
  const net = createHarnessNet();
  let writes = 0;
  const balancer = createHarnessLoadBalancer({
    net,
    now: () => 0,
    listBackends: () => [
      {
        id: 'server',
        fetch: async () => {
          writes++;
          return new Response(null);
        },
      },
    ],
  });
  const barrier = net.holdHttp('alice', '/api/mutations', { admitted: true });
  const controller = new AbortController();
  const request = balancer
    .fetchFrom('alice')('https://app.example/api/mutations', {
      method: 'POST',
      body: '{}',
      signal: controller.signal,
    })
    .catch((error: unknown) => error);
  await flush();
  expect(barrier.requestsStarted()).toBe(1);
  controller.abort();
  expect(await request).toMatchObject({ name: 'HttpAbortError' });
  net.partition('alice', 'server');
  barrier.acceptWithoutAnswer();
  await flush();
  expect(writes).toBe(1);
  net.dispose();
});

test('disposing a held admitted request prevents a write after teardown', async () => {
  const net = createHarnessNet();
  let writes = 0;
  const fetch = net.wrapHop('alice', 'server', async () => {
    writes++;
    return new Response(null);
  });
  const barrier = net.holdHttp('alice', '/api/mutations', { admitted: true });
  const request = fetch('https://app.example/api/mutations', {
    method: 'POST',
    body: '{}',
  }).catch((error: unknown) => error);
  await flush();
  expect(barrier.requestsStarted()).toBe(1);
  net.dispose();
  expect(await request).toMatchObject({ name: 'HttpAbortError' });
  barrier.release();
  await flush();
  expect(writes).toBe(0);
});

test('an admitted write releases its held response when the caller aborts', async () => {
  const net = createHarnessNet();
  let cancelled = false;
  const fetch = net.wrapHop(
    'alice',
    'server',
    async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        })
      )
  );
  const barrier = net.holdHttp('alice', '/api/mutations', { admitted: true });
  barrier.acceptWithoutAnswer();
  const controller = new AbortController();
  const request = fetch('https://app.example/api/mutations', {
    method: 'POST',
    body: '{}',
    signal: controller.signal,
  }).catch((error: unknown) => error);
  await flush();
  controller.abort();
  expect(await request).toMatchObject({ name: 'HttpAbortError' });
  await flush();
  expect(cancelled).toBe(true);
  net.dispose();
});
