import { afterEach, expect, test } from 'bun:test';
import { createWallOpenAuthSession } from '@libs/app-root-client/wall-open-auth-session';

const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.window = originalWindow;
});

// regression: social-auth-popup-blocked
test('OAuth navigates the current tab when an integrated browser blocks popups', async () => {
  const navigations: string[] = [];
  globalThis.window = {
    open: () => {
      throw new Error(
        'Popup window was blocked by the browser or failed to open.'
      );
    },
    location: { assign: (url: string) => navigations.push(url) },
  } as unknown as Window & typeof globalThis;
  const launch =
    'http://localhost:3000/api/auth/oauth/launch?provider=google&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fsso-callback';
  let settled = false;
  const pending = createWallOpenAuthSession()(
    launch,
    'http://localhost:3000/sso-callback'
  );
  void pending.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );

  await Promise.resolve();
  expect(navigations).toEqual([launch]);
  expect(settled).toBe(false);
});
