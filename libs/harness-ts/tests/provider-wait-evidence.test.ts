import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { harnessIdpAccountId } from '@libs/harness-ts/idp';
import { completeProviderSignIn } from '@libs/harness-ts/provider-walk';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

test.each([
  ['Choose an account · OAuth Emulator', 'chooser'],
  ['bob@example.com', 'unknown provider page'],
])(
  'a stalled first marker read records its native page classification',
  async (title, page) => {
    const google = 'http://google.test';
    const failure =
      page === 'chooser'
        ? 'document-node oauth-mock-chooser isVisible: opener.cdp(Runtime.evaluate) pending'
        : 'view visibleRegion: opener.cdp(Accessibility.getFullAXTree) pending';
    const ui = {
      get: () => ({
        isVisible: async () => {
          throw new Error(failure);
        },
      }),
    } as unknown as Driver;
    const browser = {
      documentControls: () => ({
        ...ui,
        visibleRegion: async () => {
          throw new Error(failure);
        },
      }),
      readyDocument: async () => ({ origin: google, title }),
    };
    const s = {
      actors: new Map([['bob', { browser }]]),
      session: {
        ports: {
          ui: { kind: 'bun-webview', webOrigin: 'http://app.test' },
          http: { kind: 'stack', idpOrigins: { google } },
        },
        scheduler: { virtual: true },
      },
    } as unknown as ProductHarness;
    await expect(
      completeProviderSignIn({
        s,
        ui,
        actorId: 'bob',
        answers: { provider: 'google', email: 'bob@example.com' },
        done: async () => false,
      })
    ).rejects.toThrow(
      new Error(
        `a provider sign-in screen (bob, google, last submitted: none; observed: none) (reading: ${page}): ${failure}`
      )
    );
  }
);

// regression: provider-wait-evidence
test('a timed-out sign-in identifies the person, submitted screen and recent native documents', async () => {
  const google = 'http://google.test';
  const api = 'http://api.test';
  const app = 'http://app.test';
  const chooser = {
    origin: google,
    title: 'Choose an account · OAuth Emulator',
  };
  const pages = [
    chooser,
    chooser,
    null,
    { origin: google, title: 'Continue to your app · OAuth Emulator' },
    { origin: api, title: 'Relay' },
    { origin: google, title: 'bob@example.com' },
    { origin: google, title: 'Review access · OAuth Emulator' },
  ];
  let index = 0;
  const taps: string[] = [];
  const ui = {
    get: (id: string) => ({
      attribute: async () => harnessIdpAccountId('bob@example.com'),
      isVisible: async () => index === 0,
      tap: async () => {
        taps.push(id);
        index++;
      },
    }),
  } as unknown as Driver;
  const browser = {
    documentControls: () => ({ ...ui, visibleRegion: async () => null }),
    readyDocument: async () => pages[index],
  };
  const s = {
    actors: new Map([['bob', { browser }]]),
    session: {
      ports: {
        ui: { kind: 'bun-webview', webOrigin: app },
        http: { kind: 'stack', origin: api, idpOrigins: { google } },
      },
      scheduler: { virtual: true, starvedAdvances: () => 0 },
      advanceTime: async () => {
        index = Math.min(index + 1, pages.length - 1);
      },
      waitForIdle: async () => {},
    },
  } as unknown as ProductHarness;
  await expect(
    completeProviderSignIn({
      s,
      ui,
      actorId: 'bob',
      answers: { provider: 'google', email: 'bob@example.com' },
      done: async () => false,
    })
  ).rejects.toThrow(
    new Error(
      'Timed out after 15000ms waiting for a provider sign-in screen (bob, google, last submitted: chooser; observed: provider return → API relay → unknown provider page without a visible form → consent marker absent)'
    )
  );
  expect(taps).toEqual([expect.stringMatching(/^oauth-mock-account-/)]);
});
