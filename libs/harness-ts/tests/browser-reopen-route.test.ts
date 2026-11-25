import { expect, test } from 'bun:test';
import type { ActorBrowserStorage } from '@libs/harness-ts/actor-browser-storage';
import type { Harness } from '@libs/harness-ts/create-harness';
import { launchActor } from '@libs/harness-ts/launch-actor';

// regression: browser-reopen-loads-game-twice
test('reopening the same device boots directly on its saved game address', async () => {
  const opened: string[] = [];
  const storage = {
    reopenPath: '/custom-game/pong?seat=left#court',
    dataStore: { directory: '/devices/alice' },
    browser: {
      async open({ initialUrl }: { initialUrl: string }) {
        opened.push(initialUrl);
        return { view: {}, driver: { launch: async () => {} } };
      },
    },
  } as unknown as ActorBrowserStorage;
  await launchActor({
    ui: { kind: 'bun-webview', webOrigin: 'http://localhost:34305' },
    id: 'alice',
    harness: {} as Harness,
    browserStorage: storage,
  });
  expect(opened).toEqual([
    'http://localhost:34305/custom-game/pong?seat=left#court',
  ]);
});
