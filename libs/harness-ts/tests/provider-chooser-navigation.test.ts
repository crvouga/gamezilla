import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  createHarnessIdps,
  HARNESS_GOOGLE_REDIRECT_URI,
  harnessAppleClientKeys,
  harnessIdpAccountId,
} from '@libs/harness-ts/idp';
import { completeProviderSignIn } from '@libs/harness-ts/provider-walk';
import { HARNESS_GOOGLE_CLIENT_ID } from '@libs/sub-shared-ts/harness-constants';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

const google = 'http://google.test';
const app = 'http://app.test';

async function checkGoogleSignIn(
  separator: string,
  chooserHeading?: string
): Promise<void> {
  const staleTitle = chooserHeading !== undefined;
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
  const accountId = harnessIdpAccountId('alice@example.com');
  const accountButton = 'oauth-mock-account-' + accountId;
  const ui = {
    get: (id: string) => ({
      attribute: async (key: string) =>
        id === accountButton && key === 'value' ? accountId : null,
      isVisible: async () => {
        if (staleTitle && id === 'oauth-mock-chooser')
          throw new Error(
            'opener.cdp(Runtime.evaluate) [loading=false, navigation metadata changed=false] #1 pending'
          );
        if ((!staleTitle && index === 1) || index === 3 || index === 4)
          throw new Error(
            `node ${id} isVisible: Inspected target navigated or closed`
          );
        if (id === 'oauth-mock-chooser') return index <= 1;
        if (id === 'oauth-mock-consent') return index === 2;
        // The named region is already exposed while its entrance animation has opacity zero.
        return !staleTitle && id === accountButton && index === 0;
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
      visibleRegion: async (
        origin: string,
        regions: Record<string, string>
      ) => {
        expect(origin).toBe(google);
        markerBudgets.push(remainingMs());
        return regions[chooserHeading!];
      },
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
  expect(taps).toEqual([accountButton, 'oauth-mock-allow']);
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
// regression: battleship-unknown-provider-first-read
// regression: listed-provider-account-signup
test('Alice answers a visible Google chooser while its native title still belongs to the app', async () => {
  const { google: idp } = createHarnessIdps({
    clock: { now: () => 1_700_000_000_000 },
    appleKeys: await harnessAppleClientKeys(),
    toApi: () => async () => new Response(null, { status: 204 }),
  });
  idp.addAccount({ handle: 'alice', email: 'alice@example.com' });
  const url = new URL('/o/oauth2/v2/auth', idp.origin);
  url.search = new URLSearchParams({
    client_id: HARNESS_GOOGLE_CLIENT_ID,
    redirect_uri: HARNESS_GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state: 'test-state',
  }).toString();
  const response = await idp.fetch(url.href);
  expect(response.status).toBe(200);
  const doc = new DOMParser().parseFromString(
    await response.text(),
    'text/html'
  );
  const chooser = doc.querySelector(
    'section[data-testid="oauth-mock-chooser"]'
  );
  const heading = doc.getElementById(
    chooser?.getAttribute('aria-labelledby') ?? ''
  )?.textContent;
  const id = harnessIdpAccountId('alice@example.com');
  expect(
    chooser
      ?.querySelector(`[data-testid="oauth-mock-account-${id}"]`)
      ?.getAttribute('value')
  ).toBe(id);
  if (!heading)
    throw new Error('The provider chooser needs an accessible name');
  await checkGoogleSignIn('·', heading);
});
