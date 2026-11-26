import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { completeProviderSignIn } from '@libs/harness-ts/provider-walk';
import { Handles } from '@libs/test-ids-shared-ts/handles';
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
      ['alice', { browser: { readyOrigin: async () => origin } }],
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
    actors: new Map([['alice', { browser: { readyOrigin: async () => app } }]]),
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
