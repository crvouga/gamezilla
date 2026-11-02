import { expect, test } from 'bun:test';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { quickPreviewCommand } from '@apps/product-ts/scripts/preview-quick-command';
import { quickPreviewReady } from '@apps/product-ts/scripts/preview-quick-readiness';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';

function child() {
  const process = new EventEmitter();
  const stderr = new EventEmitter();
  return {
    events: process,
    stderr,
    port: Object.assign(process, { stderr }) as unknown as ChildProcess,
  };
}

// regression: dynamic-preview-worktree-routing
test('dynamic URLs and readiness belong to the connector that announced them', async () => {
  const time = createHarnessClock();
  const first = child();
  const second = child();
  const published: string[] = [];
  const a = quickPreviewReady(first.port, time.timers, (url) =>
    published.push(url)
  );
  const b = quickPreviewReady(second.port, time.timers, (url) =>
    published.push(url)
  );
  first.stderr.emit('data', Buffer.from('https://first-worktree.trycloud'));
  first.stderr.emit('data', Buffer.from('flare.com |'));
  expect(published).toEqual(['https://first-worktree.trycloudflare.com']);
  second.stderr.emit('data', Buffer.from('Registered tunnel connection'));
  second.stderr.emit(
    'data',
    Buffer.from('https://second-worktree.trycloudflare.com |')
  );
  first.stderr.emit('data', Buffer.from('Registered tunnel connection'));
  expect(await a).toBe('https://first-worktree.trycloudflare.com');
  expect(await b).toBe('https://second-worktree.trycloudflare.com');
  expect(time.clock.pendingOneShotCount()).toBe(0);
  expect(first.stderr.listenerCount('data')).toBe(0);
});

test('dynamic tunnel failures time out and detach without publishing a guessed address', async () => {
  const time = createHarnessClock();
  const process = child();
  const pending = quickPreviewReady(process.port, time.timers, () => {
    throw new Error('Unexpected address');
  }).catch((error: unknown) => error);
  process.stderr.emit(
    'data',
    Buffer.from('https://example.com Registered tunnel connection')
  );
  time.clock.advance(60_000);
  expect(await pending).toMatchObject({
    message: expect.stringContaining('retry Run'),
  });
  expect(process.stderr.listenerCount('data')).toBe(0);
});

test('quick connections target one worktree listener and always restrict allowed emails', () => {
  const command = (origin: string, hostname: string) =>
    quickPreviewCommand({
      origin,
      hostname,
      configPath: '/checkout/preview/quick-config.json',
      emails: ['developer@example.com'],
    });
  expect(command('http://127.0.0.1:5240', 'first.localhost')).toContain(
    'http://127.0.0.1:5240'
  );
  expect(command('http://127.0.0.1:5340', 'second.localhost')).not.toContain(
    'http://127.0.0.1:5240'
  );
  expect(command('http://127.0.0.1:5240', 'first.localhost')).toContain(
    '--allowed-mail'
  );
  expect(() => command('http://other-host:5240', 'first.localhost')).toThrow(
    'loopback'
  );
  expect(() =>
    quickPreviewCommand({
      origin: 'http://127.0.0.1:5240',
      hostname: 'first.localhost',
      configPath: '/config',
      emails: [],
    })
  ).toThrow('developer emails');
});
