import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { completeProviderSignIn } from '@libs/harness-ts/provider-walk';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

test('Apple form-post in a script-running browser submits only once', async () => {
  // regression: apple-handoff-double-submit
  let origin = 'http://apple.test';
  let clicks = 0;
  const ui = {
    get: (id: string) => ({
      isVisible: () => Promise.resolve(id === 'oauth-mock-form-post'),
      tap: () => {
        clicks += 1;
        throw new Error(
          'A second form submission consumes an already used OAuth state'
        );
      },
    }),
  } as unknown as Driver;
  const s = {
    actors: new Map([
      ['alice', { browser: { readyOrigin: async () => origin } }],
    ]),
    session: {
      ports: {
        ui: { kind: 'bun-webview', webOrigin: 'http://app.test' },
        http: { kind: 'stack', idpOrigins: { apple: origin } },
      },
      scheduler: { virtual: true, starvedAdvances: () => 0 },
      advanceTime: async () => {
        origin = 'http://app.test';
      },
      waitForIdle: async () => {},
    },
  } as unknown as ProductHarness;
  await completeProviderSignIn({
    s,
    ui,
    actorId: 'alice',
    answers: { provider: 'apple', email: 'alice@example.com' },
    done: () => Promise.resolve(origin === 'http://app.test'),
  });
  expect(origin).toBe('http://app.test');
  expect(clicks).toBe(0);
});
