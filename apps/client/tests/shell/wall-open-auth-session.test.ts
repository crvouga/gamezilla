import { afterEach, describe, expect, test } from 'bun:test';
import type { Timers } from '@pkgs/clock';
import {
  AUTH_POPUP_ACTIVE_KEY,
  AUTH_POPUP_RESULT_KEY,
  createWallOpenAuthSession,
} from '../../src/shell/wall-open-auth-session';

type StorageMock = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

const originalWindow = (globalThis as { window?: unknown }).window;
const originalBroadcastChannel = (globalThis as { BroadcastChannel?: unknown })
  .BroadcastChannel;

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
  if (originalBroadcastChannel === undefined) {
    delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  } else {
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel =
      originalBroadcastChannel;
  }
});

describe('createWallOpenAuthSession', () => {
  test('uses callback handoff when COOP reports the popup closed', async () => {
    const values = new Map<string, string>();
    const storage: StorageMock = {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => {
        values.delete(key);
      },
      setItem: (key, value) => {
        values.set(key, value);
      },
    };
    const intervals: Array<() => void> = [];
    const timers: Timers = {
      setTimeout: () => Symbol('timeout'),
      clearTimeout: () => undefined,
      setInterval: (fn) => {
        intervals.push(fn);
        return Symbol('interval');
      },
      clearInterval: () => undefined,
    };
    const popup = {
      closed: true,
      location: null,
      close: () => undefined,
      focus: () => undefined,
    };
    const fakeWindow = {
      localStorage: storage,
      location: { origin: 'http://app.test' },
      open: () => popup,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    (globalThis as { window?: unknown }).window = fakeWindow;
    delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;

    const callbackUrl = 'http://app.test/sso-callback';
    const resultPromise = createWallOpenAuthSession(timers)(
      'http://idp.test/authorize',
      callbackUrl
    );
    expect(values.get(AUTH_POPUP_ACTIVE_KEY)).toBe('1');

    values.set(AUTH_POPUP_RESULT_KEY, `${callbackUrl}?code=exchange-code`);
    intervals[0]?.();
    const result = await resultPromise;
    expect(result).toEqual({
      type: 'success',
      url: `${callbackUrl}?code=exchange-code`,
    });
    expect(values.has(AUTH_POPUP_ACTIVE_KEY)).toBe(false);
  });
});
