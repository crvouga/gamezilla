/** What a signed-out person does: the app opens, Google sign-in starts. */

import { openGlobalMenu } from '@libs/harness/system/driver-gestures';
import { Handles } from '@libs/test-ids';
import type { Driver } from '@pkgs/ui-testing';
import {
  atTabShell,
  check,
  expectVisible,
  JOURNEY_WAIT_MS,
  tap,
} from './journey-gestures';
import type { JourneyBrowser } from './journey-types';

/** Past the boot screen, on the tabs. */
export async function appBooted(ui: Driver): Promise<void> {
  await atTabShell(ui);
  await ui
    .get(Handles.bootLoading)
    .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
  await expectVisible(ui, Handles.tabSpaces);
  await expectVisible(ui, Handles.tabProfile);
}

export async function startGoogleSignIn(ui: Driver): Promise<void> {
  await atTabShell(ui);
  await openGlobalMenu(ui, Handles.globalMenuAccount, JOURNEY_WAIT_MS);
  await tap(ui, Handles.globalMenuAccount);
  await tap(ui, Handles.accountSignIn);
  await tap(ui, Handles.authMethodGoogle);
}

function isOauthLaunch(url: string): boolean {
  try {
    return new URL(url).pathname.endsWith('/auth/oauth/launch');
  } catch {
    return false;
  }
}

/**
 * The popup opened our OAuth launch, and that launch hands the person to
 * Google with our callback. It stops at Google's door: a real Google account
 * cannot be scripted.
 */
export async function expectGoogleHandOff(
  browser: JourneyBrowser
): Promise<void> {
  const launchUrl = await browser.waitForPopup(isOauthLaunch, JOURNEY_WAIT_MS);
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
  const expected = `${browser.oauthCallbackOrigin}/api/auth/callback/google`;
  const redirectUri = authorize.searchParams.get('redirect_uri');
  check(
    redirectUri === expected,
    `Google redirect_uri is ${String(redirectUri)}, expected ${expected}`
  );
}
