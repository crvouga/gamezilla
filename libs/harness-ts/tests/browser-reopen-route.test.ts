import { expect, test } from 'bun:test';
import type { ActorBrowserStorage } from '@libs/harness-ts/actor-browser-storage';
import { createHarnessAppBuilds } from '@libs/harness-ts/app-build';
import type { Harness } from '@libs/harness-ts/create-harness';
import { launchActor } from '@libs/harness-ts/launch-actor';

const savedGame = '/custom-game/pong?seat=left#court';
const invitation = '/space/b20b88cb-801f-4eff-8c09-6e320313e673';

// regression: browser-reopen-loads-game-twice
// regression: finished-match-watcher-invitation-boot
test.each([
  { initialPath: undefined, expected: savedGame },
  { initialPath: invitation, expected: invitation },
])(
  'the browser opens directly at $expected',
  async ({ initialPath, expected }) => {
    const opened: string[] = [];
    const storage = {
      reopenPath: savedGame,
      dataStore: { directory: '/devices/carol' },
      browser: {
        async open({ initialUrl }: { initialUrl: string }) {
          opened.push(initialUrl);
          return {
            view: { evaluate: async () => null },
            driver: { launch: async () => {} },
          };
        },
      },
    } as unknown as ActorBrowserStorage;
    await launchActor({
      ui: { kind: 'bun-webview', webOrigin: 'http://localhost:34305' },
      id: 'carol',
      initialPath,
      harness: { appBuilds: createHarnessAppBuilds() } as unknown as Harness,
      browserStorage: storage,
    });
    expect(opened).toEqual([`http://localhost:34305${expected}`]);
  }
);
