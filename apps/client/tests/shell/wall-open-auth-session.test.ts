import { afterEach, expect, test } from 'bun:test';
import {
  createWallOpenAuthSession,
  handOffPopupAuthCallback,
} from '@apps/client/shell/wall-open-auth-session';
import { wallTimers } from '@pkgs/clock/wall';

const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  });
});

test('popup callback reaches the original tab after its window reference is severed', async () => {
  let launchUrl = '';
  const popup = {
    closed: true,
    get location(): never {
      throw new Error('cross-origin popup');
    },
    close() {},
    focus() {},
  };
  const parentWindow = {
    location: { origin: 'http://localhost:5173' },
    open(url: string) {
      launchUrl = url;
      return popup;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: parentWindow,
  });

  const callbackUrl = 'http://localhost:5173/sso-callback';
  const session = createWallOpenAuthSession(wallTimers, () => 'attempt-1')(
    'http://localhost:8788/api/auth/oauth/launch?provider=google',
    callbackUrl
  );
  const callback = new URL(
    new URL(launchUrl).searchParams.get('callbackUrl') ?? ''
  );
  expect(callback.searchParams.get('authPopup')).toBe('attempt-1');
  callback.searchParams.set('code', 'exchange-code');

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { href: callback.toString() },
      opener: null,
      close() {},
    },
  });
  expect(handOffPopupAuthCallback(wallTimers)).toBe(true);
  expect(await session).toEqual({ type: 'success', url: callback.toString() });
});
