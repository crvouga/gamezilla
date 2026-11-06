import { expect, mock, test } from 'bun:test';
import { captureActorScreenshots } from '@libs/harness-ts/actor-screenshots';
import type { ProductUi } from '@libs/harness-ts/ports';

const BROWSER = {
  kind: 'bun-webview',
  webOrigin: 'http://127.0.0.1:3000',
  captureScreenshots: true,
} as const satisfies ProductUi;

// regression: stack-journey-missing-png-evidence
test('a completed critical journey frame keeps both real actors in the report', async () => {
  const alice = new Uint8Array([137, 80, 78, 71, 1]);
  const bob = new Uint8Array([137, 80, 78, 71, 2]);
  const actors = new Map([
    ['alice', { screenshot: async () => alice }],
    ['bob', { screenshot: async () => bob }],
  ]);
  expect(await captureActorScreenshots(actors, BROWSER)).toEqual({
    alice,
    bob,
  });
});

test('disabled capture and in-process hosts do no screenshot work', async () => {
  const screenshot = mock(async () => new Uint8Array([1]));
  const actors = new Map([['alice', { screenshot }]]);
  expect(
    await captureActorScreenshots(actors, {
      ...BROWSER,
      captureScreenshots: false,
    })
  ).toBeNull();
  expect(
    await captureActorScreenshots(actors, {
      kind: 'solid-dom',
      focusedActor: () => 'alice',
      runFor: async () => {},
    })
  ).toBeNull();
  expect(screenshot).not.toHaveBeenCalled();
});

test('a step before any browser opens has no fabricated frame', async () => {
  expect(await captureActorScreenshots(new Map(), BROWSER)).toBeNull();
  expect(
    await captureActorScreenshots(new Map([['alice', {}]]), BROWSER)
  ).toBeNull();
});

test('native capture failures and empty frames remain errors', async () => {
  const failure = new Error('Chrome closed during frame capture');
  await expect(
    captureActorScreenshots(
      new Map([['alice', { screenshot: () => Promise.reject(failure) }]]),
      BROWSER
    )
  ).rejects.toBe(failure);
  await expect(
    captureActorScreenshots(
      new Map([['alice', { screenshot: async () => new Uint8Array() }]]),
      BROWSER
    )
  ).rejects.toThrow('empty screenshot for alice');
});
