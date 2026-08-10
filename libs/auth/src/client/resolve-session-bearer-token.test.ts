import { describe, expect, test } from 'bun:test';
import { createSimIo } from '@pkgs/io';

import { SessionBearerTokenResolver } from './resolve-session-bearer-token';

const io = createSimIo({ seed: 1 });

describe('SessionBearerTokenResolver', () => {
  test('returns cached bearer without minting', async () => {
    const calls: Array<boolean | undefined> = [];
    const token = await new SessionBearerTokenResolver(io.timers).resolve(
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
    const token = await new SessionBearerTokenResolver(io.timers).resolve(
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
    const token = await new SessionBearerTokenResolver(io.timers).resolve(
      { getFreshToken: async () => null },
      { delaysMs: [0, 0] }
    );
    expect(token).toBeNull();
  });
});
