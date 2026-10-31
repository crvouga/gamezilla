import { expect, test } from 'bun:test';
import { traceBrowserStartup } from '@libs/app-root-client-ts/browser-boundaries';
import { installBrowserObsHelper } from '@libs/app-root-client-ts/browser-identity';

function startup(): readonly string[] {
  const host = window as unknown as { __obs: () => string };
  return (
    host
      .__obs()
      .split('\n')
      .find((line) => line.startsWith('startup.pending=')) ?? ''
  )
    .slice('startup.pending='.length)
    .split(',')
    .filter(Boolean);
}

// regression: client-startup-pending-stage-missing
test('a stalled startup stage stays visible before completion and concurrent waits settle independently', async () => {
  installBrowserObsHelper();
  const first = Promise.withResolvers<void>();
  const second = Promise.withResolvers<void>();
  const firstWait = traceBrowserStartup(
    'client.boot.lease',
    () => first.promise
  );
  const secondWait = traceBrowserStartup(
    'client.boot.lease',
    () => second.promise
  );
  try {
    expect(startup().filter((stage) => stage === 'client.boot.lease')).toEqual([
      'client.boot.lease',
    ]);
    first.resolve();
    await firstWait;
    expect(startup()).toContain('client.boot.lease');
    second.reject(new Error('lease failed'));
    await expect(secondWait).rejects.toThrow('lease failed');
    expect(startup()).not.toContain('client.boot.lease');
  } finally {
    first.resolve();
    second.resolve();
    await Promise.allSettled([firstWait, secondWait]);
  }
});

test('a synchronous startup failure clears its pending stage', async () => {
  installBrowserObsHelper();
  await expect(
    traceBrowserStartup('client.boot.registry', () => {
      expect(startup()).toContain('client.boot.registry');
      throw new Error('invalid registry');
    })
  ).rejects.toThrow('invalid registry');
  expect(startup()).not.toContain('client.boot.registry');
});
