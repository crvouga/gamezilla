import { expect, test } from 'bun:test';

test('DOM registration retains the native isolated-realm message channel', async () => {
  // regression: solid-dom-worker-message-channel
  const worker = new Worker(new URL('./worker-port.ts', import.meta.url).href, {
    preload: ['@pkgs/bun-test-solid-client-ts/register'],
  });
  try {
    const reply = new Promise<unknown>((resolve, reject) => {
      worker.addEventListener('message', (event) => resolve(event.data));
      worker.addEventListener('error', (event) =>
        reject(new Error(event.message))
      );
    });
    worker.postMessage('isolated application');
    expect(await reply).toEqual({
      text: 'isolated application',
      url: 'http://localhost:3000/',
    });
  } finally {
    worker.terminate();
  }
});
