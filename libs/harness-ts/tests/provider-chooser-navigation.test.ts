import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { completeProviderSignIn } from '@libs/harness-ts/provider-walk';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

const google = 'http://google.test';
const app = 'http://app.test';

async function checkGoogleSignIn(
  separator: string,
  staleTitle = false
): Promise<void> {
  const pages = [
    [google, `Choose an account ${separator} OAuth Emulator`],
    [google, `Choose an account ${separator} OAuth Emulator`],
    [google, `Review access ${separator} OAuth Emulator`],
    [google, `Review access ${separator} OAuth Emulator`],
    [google, `Continue to your app ${separator} OAuth Emulator`],
    [app, 'Account'],
  ] as const;
  let index = 0;
  const page = () => pages[index]!;
  const taps: string[] = [];
  const ui = {
    get: (id: string) => ({
      isVisible: async () => {
        if ((!staleTitle && index === 1) || index === 3 || index === 4)
          throw new Error(
            `node ${id} isVisible: Inspected target navigated or closed`
          );
        if (id === 'oauth-mock-chooser') return index <= 1;
        if (id === 'oauth-mock-consent') return index === 2;
        return id.startsWith('oauth-mock-account-') && index === 0;
      },
      tap: async () => {
        taps.push(id);
        index += 1;
      },
    }),
  } as unknown as Driver;
  let now = 0;
  const markerBudgets: number[] = [];
  const browser = {
    documentControls: (remainingMs: () => number) => ({
      get: (id: string) => {
        if (id === 'oauth-mock-chooser') markerBudgets.push(remainingMs());
        return ui.get(id);
      },
    }),
    readyDocument: async () => {
      now += 420;
      return {
        origin: page()[0],
        title:
          staleTitle && page()[0] === google && index < 2
            ? 'Account'
            : page()[1],
      };
    },
  };
  const s = {
    actors: new Map([['alice', { browser }]]),
    session: {
      ports: {
        ui: { kind: 'bun-webview', webOrigin: app },
        http: { kind: 'stack', idpOrigins: { google } },
      },
      scheduler: {
        virtual: false,
        clock: { now: () => now },
        starvedAdvances: () => 0,
      },
      advanceTime: async () => {
        // The provider waits for a person on the chooser and consent form.
        if (index === 1 || index === 3 || index === 4) index += 1;
      },
      waitForIdle: async () => {},
    },
  } as unknown as ProductHarness;
  await completeProviderSignIn({
    s,
    ui: {
      get: () => {
        throw new Error('provider control resolved through popup discovery');
      },
    },
    actorId: 'alice',
    answers: { provider: 'google', email: 'alice@example.com' },
    done: async () => page()[0] === app,
  });
  expect(markerBudgets).toEqual(staleTitle ? [14_580, 14_580] : [14_580]);
  expect(taps).toEqual([
    expect.stringMatching(/^oauth-mock-account-/),
    'oauth-mock-allow',
  ]);
  expect(page()[0]).toBe(app);
}

// regression: provider-chooser-navigation
// regression: provider-marker-opener-evaluation
// regression: chrome-provider-title-escape
test.each(['·', String.raw`\u00b7`])(
  'Google chooser and consent are answered once with native title separator %s',
  (separator) => checkGoogleSignIn(separator)
);

// regression: word-tiles-unknown-provider-document
test('Alice answers a visible Google chooser while its native title still belongs to the app', () =>
  checkGoogleSignIn('·', true));
