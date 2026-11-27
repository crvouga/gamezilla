import { expect, test } from 'bun:test';
import { ensureActor } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { TimeoutError } from '@pkgs/ui-testing-root-shared-ts/timeout-error';

// regression: browser-actor-shell-timeout-context
test('Alice’s first shell timeout records the startup state before she joins the harness', async () => {
  const timeout = new TimeoutError(
    'node status-current-user wait: Timed out after 15000ms waiting for the account menu, or the top bar of an open space',
    15_000
  );
  const actor = {
    id: 'alice',
    browser: { currentUrl: async () => 'http://app.test/?code=secret#token' },
    ui: {
      get: (id: string) => ({
        isVisible: async () => false,
        wait: async (
          state: string,
          options: { visibleOr: string[]; timeoutMs: number }
        ) => {
          expect([id, state, options.timeoutMs, options.visibleOr]).toEqual([
            Handles.statusCurrentUser,
            'visible',
            15_000,
            [Handles.spaceClose],
          ]);
          throw timeout;
        },
      }),
      snapshotHtml: async () =>
        '<div class="startup-shell startup-shell-failed" data-startup-shell=""><code>private detail</code></div>',
    },
  };
  const s = {
    runtime: { launchActor: async () => actor },
    session: {
      waitForIdle: async () => {},
      ports: { timers: createHarnessClock().timers },
    },
    actors: new Map(),
  } as unknown as ProductHarness;
  const error = await ensureActor(s, 'alice').catch((cause: Error) => cause);
  expect(error).toBeInstanceOf(TimeoutError);
  expect(error).toHaveProperty('cause', timeout);
  expect(error).toHaveProperty(
    'message',
    `${timeout.message}; alice at http://app.test/ (startup shell failed)`
  );
  expect(s.actors.size).toBe(0);
});
