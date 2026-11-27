import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { completeProviderSignIn } from '@libs/harness-ts/provider-walk';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

const app = 'http://app.test';
const google = 'http://google.test';

// regression: sign-in-outcome-read-during-navigation
test('Google sign-in reads Done on the returned app document after consent', async () => {
  const origins = [google, google, null, 'http://relay.test', app, app];
  let origin: string | null | undefined = null;
  let ready = false;
  const taps: string[] = [];
  const outcomes: boolean[] = [];
  const ui = {
    get: (id: string) => ({
      isVisible: async () => {
        if (id === Handles.authSignedInDone) {
          if (origin !== app)
            throw new Error(`node ${id} isVisible: departing document`);
          outcomes.push(ready);
          return ready;
        }
        if (origin !== google) throw new Error(`provider control on ${origin}`);
        return id === 'oauth-mock-consent';
      },
      tap: async () => {
        expect(origin).toBe(google);
        taps.push(id);
        origin = origins.shift();
      },
    }),
  } as unknown as Driver;
  const s = {
    actors: new Map([
      [
        'alice',
        {
          browser: {
            documentControls: () => ui,
            readyDocument: async () =>
              origin
                ? { origin, title: 'Review access · OAuth Emulator' }
                : null,
          },
        },
      ],
    ]),
    session: {
      ports: {
        ui: { kind: 'bun-webview', webOrigin: app },
        http: { kind: 'stack', idpOrigins: { google } },
      },
      scheduler: { virtual: true, starvedAdvances: () => 0 },
      advanceTime: async () => {
        ready = origin === app;
        origin = origins.shift();
      },
      waitForIdle: async () => {},
    },
  } as unknown as ProductHarness;
  await completeProviderSignIn({
    s,
    ui,
    actorId: 'alice',
    answers: { provider: 'google', email: 'alice@example.com' },
    done: () => ui.get(Handles.authSignedInDone).isVisible(),
  });
  expect(taps).toEqual(['oauth-mock-allow']);
  expect(outcomes).toEqual([false, true]);
});

test('the app can report a sign-in failure before it leaves for Google', async () => {
  const reads: string[] = [];
  const ui = {
    get: (id: string) => ({
      isVisible: async () => {
        reads.push(id);
        return id === Handles.authSignInFailed;
      },
    }),
  } as unknown as Driver;
  const s = {
    actors: new Map([
      [
        'alice',
        {
          browser: {
            documentControls: () => ui,
            readyDocument: async () => ({ origin: app, title: 'Account' }),
          },
        },
      ],
    ]),
    session: {
      ports: {
        ui: { kind: 'bun-webview', webOrigin: app },
        http: { kind: 'stack', idpOrigins: { google } },
      },
      scheduler: { virtual: true },
    },
  } as unknown as ProductHarness;
  await completeProviderSignIn({
    s,
    ui,
    actorId: 'alice',
    answers: { provider: 'google', email: 'alice@example.com' },
    done: async () =>
      (await ui.get(Handles.authSignedInDone).isVisible()) ||
      (await ui.get(Handles.authSignInFailed).isVisible()),
  });
  expect(reads).toEqual([Handles.authSignedInDone, Handles.authSignInFailed]);
});

function returnFromConsent(outcomeAt: number) {
  const time = createHarnessClock();
  let submitted = false;
  const clicks: string[] = [];
  const budgets: number[] = [];
  const controls = (remainingMs: () => number) => ({
    get: (id: string) => ({
      isVisible: async () => {
        if (id === 'oauth-mock-consent') return true;
        expect(id).toBe(Handles.authSignedInDone);
        budgets.push(remainingMs());
        return time.clock.now() >= outcomeAt;
      },
      tap: async () => {
        clicks.push(id);
        submitted = true;
      },
    }),
  });
  const api = 'http://relay.test';
  const browser = {
    documentControls: controls,
    currentUrl: async () => app + '/sso-callback?code=private',
    readyDocument: async () => {
      if (!submitted || time.clock.now() < 200)
        return { origin: google, title: 'Review access · OAuth Emulator' };
      if (time.clock.now() < 12_000)
        return { origin: api, title: 'Returning to the app' };
      return { origin: app, title: 'Account' };
    },
  };
  const ui = {
    snapshotHtml: async () => '<div data-testid="boot-loading"></div>',
  } as Driver;
  const s = {
    actors: new Map([['bob', { browser, ui }]]),
    session: {
      ports: {
        timers: time.timers,
        ui: { kind: 'bun-webview', webOrigin: app },
        http: { kind: 'stack', origin: api, idpOrigins: { google } },
      },
      scheduler: {
        virtual: false,
        clock: time.clock,
        starvedAdvances: () => 0,
      },
      advanceTime: async (ms: number) => {
        time.clock.advance(ms);
      },
      waitForIdle: async () => {},
    },
  } as unknown as ProductHarness;
  const result = completeProviderSignIn({
    s,
    ui,
    actorId: 'bob',
    answers: { provider: 'google', email: 'bob@example.com' },
    done: (ui) => ui.get(Handles.authSignedInDone).isVisible(),
  });
  return { result, clicks, budgets, time };
}

// regression: quoridor-returned-sign-in-budget
test('Bob sees the app finish signing in after Google consent and the API relay', async () => {
  const { result, clicks, budgets } = returnFromConsent(16_000);
  await result;
  expect(clicks).toEqual(['oauth-mock-allow']);
  expect(budgets[0]).toBe(15_000);
  expect(budgets.at(-1)).toBe(11_000);
});

test('the returned app gets one outcome deadline and identifies a stalled boot', async () => {
  const { result, clicks, time } = returnFromConsent(Infinity);
  await expect(result).rejects.toThrow(
    /the app sign-in outcome .*at http:\/\/app\.test\/sso-callback \(app boot loading\)/
  );
  expect(time.clock.now()).toBe(27_000);
  expect(clicks).toEqual(['oauth-mock-allow']);
});
