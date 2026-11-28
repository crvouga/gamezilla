import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

// regression: stale-app-worker
test('the previous worker updates immediately and unregisters without handling requests', async () => {
  for (const app of ['product-ts', 'product-client-ts']) {
    const handlers = new Map<
      string,
      (event: { waitUntil: (work: Promise<void>) => void }) => void
    >();
    const calls: string[] = [];
    runInNewContext(
      readFileSync(
        join(import.meta.dir, '../../', app, 'public/sw.js'),
        'utf8'
      ),
      {
        self: {
          addEventListener: handlers.set.bind(handlers),
          skipWaiting: async () => {
            calls.push('skipWaiting');
          },
          registration: {
            unregister: async () => {
              calls.push('unregister');
            },
          },
        },
      }
    );
    expect([...handlers.keys()]).toEqual(['install', 'activate']);
    for (const handler of handlers.values()) {
      await new Promise<void>((resolve) => handler({ waitUntil: resolve }));
    }
    expect(calls).toEqual(['skipWaiting', 'unregister']);
  }
});
