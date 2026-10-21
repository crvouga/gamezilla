import { expect, test } from 'bun:test';
import { HttpResponseScope } from '@pkgs/http-client-shared-ts/response-scope';
import { createScopedHttpClient } from '@pkgs/http-client-shared-ts/scoped-http-client';

test('one unread body fails at the request boundary and excludes URL secrets', async () => {
  // regression: worker-http-response-body-leak
  const scope = new HttpResponseScope({
    fetch: async () => Response.json({ ok: true }),
  });
  await scope.fetch('https://collector.example/v1/traces?token=secret');
  await expect(scope.finish()).rejects.toThrow(
    'GET https://collector.example/v1/traces'
  );
});

test.each(['text', 'json', 'arrayBuffer', 'blob', 'bytes'] as const)(
  'reading %s releases the response',
  async (method) => {
    const scope = new HttpResponseScope({
      fetch: async () => Response.json({ ok: true }),
    });
    const response = await scope.fetch('https://collector.example/');
    await response[method]();
    expect(response.bodyUsed).toBe(true);
    await scope.finish();
  }
);

test('cancellation releases an unread streaming body without buffering it', async () => {
  let canceled = false;
  const scope = new HttpResponseScope({
    fetch: async () =>
      new Response(
        new ReadableStream({
          cancel() {
            canceled = true;
          },
        })
      ),
  });
  const response = await scope.fetch('https://collector.example/');
  await response.body?.cancel();
  await scope.finish();
  expect(canceled).toBe(true);
});

test('a partial stream read remains a leak even though bodyUsed is true', async () => {
  let canceled = false;
  const scope = new HttpResponseScope({
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1]));
          },
          cancel() {
            canceled = true;
          },
        })
      ),
  });
  const response = await scope.fetch('https://collector.example/');
  const reader = response.body!.getReader();
  await reader.read();
  reader.releaseLock();
  expect(response.bodyUsed).toBe(true);
  await expect(scope.finish()).rejects.toThrow('HTTP response body leak');
  expect(canceled).toBe(true);
});

test('forwarding transfers a streaming response without buffering', async () => {
  const scope = new HttpResponseScope({
    fetch: async () => new Response('payload'),
  });
  const response = await scope.fetch('https://collector.example/');
  const forwarded = new Response(response.body, { status: response.status });
  await scope.finish(forwarded);
  expect(await forwarded.text()).toBe('payload');
});

test('a clone must be consumed independently of the original', async () => {
  const scope = new HttpResponseScope({
    fetch: async () => new Response('payload'),
  });
  const response = await scope.fetch('https://collector.example/');
  const clone = response.clone();
  expect(await response.text()).toBe('payload');
  await expect(scope.finish()).rejects.toThrow('HTTP response body leak');
  expect(clone.bodyUsed).toBe(false);
});

test('clones can both be consumed and released', async () => {
  const scope = new HttpResponseScope({
    fetch: async () => new Response('payload'),
  });
  const response = await scope.fetch('https://collector.example/');
  const clone = response.clone();
  expect(await Promise.all([response.text(), clone.text()])).toEqual([
    'payload',
    'payload',
  ]);
  await scope.finish();
});

test('repeated cloning permits forwarding the remaining branch', async () => {
  const scope = new HttpResponseScope({
    fetch: async () => new Response('payload'),
  });
  const response = await scope.fetch('https://collector.example/');
  const first = response.clone();
  const second = response.clone();
  expect(await Promise.all([first.text(), second.text()])).toEqual([
    'payload',
    'payload',
  ]);
  await scope.finish(response);
  expect(await response.text()).toBe('payload');
});

test('request guards preserve the original failure when no body leaked', async () => {
  const http = createScopedHttpClient({
    fetch: async () => new Response(null, { status: 204 }),
  });
  await expect(
    http.run(async () => {
      throw new Error('original failure');
    })
  ).rejects.toThrow('original failure');
});

test('a detached outbound request cannot outlive its owner', async () => {
  let resolve!: (response: Response) => void;
  const scope = new HttpResponseScope({
    fetch: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  const pending = scope.fetch('https://collector.example/');
  await expect(scope.finish()).rejects.toThrow('1 unfinished requests');
  resolve(new Response('late'));
  await expect(pending).rejects.toThrow(
    'HTTP response arrived after scope ended'
  );
});
