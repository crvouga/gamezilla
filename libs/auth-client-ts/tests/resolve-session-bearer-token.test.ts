import { describe, expect, test } from 'bun:test';
import { SessionBearerTokenResolver } from '@libs/auth-client-ts/resolve-session-bearer-token';
import { createHarnessAdapters } from '@pkgs/uuid-shared-ts/harness-adapters';

const adapters = createHarnessAdapters({ seed: 1 });

describe('SessionBearerTokenResolver', () => {
  test('returns cached bearer without minting', async () => {
    const calls: Array<boolean | undefined> = [];
    const token = await new SessionBearerTokenResolver(adapters.timers).resolve(
      {
        getFreshToken: async (options) => {
          calls.push(options?.skipCache);
          return 'cached';
        },
      },
      { delaysMs: [0] }
    );
    expect(token).toBe('cached');
    expect(calls).toEqual([undefined]);
  });

  test('mints when cache is empty', async () => {
    const calls: Array<boolean | undefined> = [];
    const token = await new SessionBearerTokenResolver(adapters.timers).resolve(
      {
        getFreshToken: async (options) => {
          calls.push(options?.skipCache);
          return options?.skipCache === true ? 'minted' : null;
        },
      },
      { delaysMs: [0] }
    );
    expect(token).toBe('minted');
    expect(calls).toEqual([undefined, true]);
  });

  test('returns null after retries exhaust', async () => {
    const token = await new SessionBearerTokenResolver(adapters.timers).resolve(
      { getFreshToken: async () => null },
      { delaysMs: [0, 0] }
    );
    expect(token).toBeNull();
  });
});
