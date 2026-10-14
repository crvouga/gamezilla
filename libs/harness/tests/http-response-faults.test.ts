import { expect, test } from 'bun:test';
import { createHarnessNet } from '@libs/harness/net';

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
