import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { completeProviderSignIn } from '@libs/harness-ts/provider-walk';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

const google = 'http://google.test';
const app = 'http://app.test';

// regression: provider-chooser-navigation
test('Google chooser and consent are answered once while the return page navigates', async () => {
  const pages = [
    [google, 'Choose an account · OAuth Emulator'],
    [google, 'Choose an account · OAuth Emulator'],
    [google, 'Review access · OAuth Emulator'],
    [google, 'Review access · OAuth Emulator'],
    [google, 'Continue to your app · OAuth Emulator'],
    [app, 'Account'],
  ] as const;
  let index = 0;
  const page = () => pages[index]!;
  const taps: string[] = [];
  const ui = {
    get: (id: string) => ({
      isVisible: async () => {
        if (index === 1 || index === 3 || index === 4)
          throw new Error(
            `node ${id} isVisible: Inspected target navigated or closed`
          );
        if (id === 'oauth-mock-chooser') return index === 0;
        if (id === 'oauth-mock-consent') return index === 2;
        return id.startsWith('oauth-mock-account-') && index === 0;
      },
      tap: async () => {
        taps.push(id);
        index += 1;
      },
    }),
  } as unknown as Driver;
  const browser = {
    readyDocument: async () => ({ origin: page()[0], title: page()[1] }),
  };
  const s = {
    actors: new Map([['alice', { browser }]]),
    session: {
      ports: {
        ui: { kind: 'bun-webview', webOrigin: app },
        http: { kind: 'stack', idpOrigins: { google } },
      },
      scheduler: { virtual: true, starvedAdvances: () => 0 },
      advanceTime: async () => {
        index += 1;
      },
      waitForIdle: async () => {},
    },
  } as unknown as ProductHarness;
  await completeProviderSignIn({
    s,
    ui,
    actorId: 'alice',
    answers: { provider: 'google', email: 'alice@example.com' },
    done: async () => page()[0] === app,
  });
  expect(taps).toEqual([
    expect.stringMatching(/^oauth-mock-account-/),
    'oauth-mock-allow',
  ]);
  expect(page()[0]).toBe(app);
});
