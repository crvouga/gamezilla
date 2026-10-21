import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { completeProviderSignIn } from '@libs/harness-ts/provider-walk';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

test('Apple form-post in a script-running browser submits only once', async () => {
  // regression: apple-handoff-double-submit
  let done = false;
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
      expect: {
        hidden: () => {
          done = true;
          return Promise.resolve();
        },
      },
    }),
  } as unknown as Driver;
  const s = {
    session: { ports: { ui: { kind: 'bun-webview' } } },
  } as unknown as ProductHarness;
  await completeProviderSignIn({
    s,
    ui,
    actorId: 'alice',
    answers: { provider: 'apple', email: 'alice@example.com' },
    done: () => Promise.resolve(done),
  });
  expect(done).toBe(true);
  expect(clicks).toBe(0);
});
