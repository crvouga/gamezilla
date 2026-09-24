/** Journeys a signed-out person takes: the app opens, sign-in starts. */

import { openGlobalMenu } from '@libs/sim-harness/system/driver-gestures';
import { Handles } from '@libs/test-ids';
import {
  atTabShell,
  check,
  expectVisible,
  JOURNEY_WAIT_MS,
  tap,
} from './journey-steps';
import type { CriticalJourney } from './journey-types';

export const appBoots: CriticalJourney = {
  id: 'app-boots',
  title: 'The app opens past the boot screen into the tab shell',
  access: 'anonymous',
  requiresBrowser: false,
  run: async ({ ui }) => {
    await atTabShell(ui);
    await ui
      .get(Handles.bootLoading)
      .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
    await expectVisible(ui, Handles.tabSpaces);
    await expectVisible(ui, Handles.tabProfile);
  },
};

function isOauthLaunch(url: string): boolean {
  try {
    return new URL(url).pathname.endsWith('/auth/oauth/launch');
  } catch {
    return false;
  }
}

/**
 * Tapping "Sign in with Google" opens a popup on our OAuth launch, and that
 * launch hands the person to Google with our callback. The journey stops at
 * Google's door: a real Google account cannot be scripted.
 */
export const googleSignInStarts: CriticalJourney = {
  id: 'google-sign-in-starts',
  title: 'Sign in with Google hands the person to Google with our callback',
  access: 'anonymous',
  requiresBrowser: true,
  run: async ({ ui, browser }) => {
    check(browser !== null, 'google-sign-in-starts needs a real browser');
    await atTabShell(ui);
    await openGlobalMenu(ui, Handles.globalMenuAccount, JOURNEY_WAIT_MS);
    await tap(ui, Handles.globalMenuAccount);
    await tap(ui, Handles.accountSignIn);
    await tap(ui, Handles.authMethodGoogle);

    const launchUrl = await browser.waitForPopup(
      isOauthLaunch,
      JOURNEY_WAIT_MS
    );
    const launch = new URL(launchUrl);
    check(
      launch.searchParams.get('provider') === 'google',
      `popup launched provider ${String(launch.searchParams.get('provider'))}, not google`
    );
    const res = await browser.http.fetch(launchUrl, { redirect: 'manual' });
    check(
      res.status === 302,
      `OAuth launch answered HTTP ${String(res.status)}, not 302`
    );
    const authorize = new URL(res.headers.get('location') ?? 'about:blank');
    check(
      authorize.hostname === 'accounts.google.com',
      `OAuth launch redirected to ${authorize.hostname}, not accounts.google.com`
    );
    const expected = `${browser.apiOrigin}/api/auth/callback/google`;
    const redirectUri = authorize.searchParams.get('redirect_uri');
    check(
      redirectUri === expected,
      `Google redirect_uri is ${String(redirectUri)}, expected ${expected}`
    );
  },
};
