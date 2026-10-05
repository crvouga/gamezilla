/** What a signed-out person does: the app opens, Google sign-in starts. */

import { openGlobalMenu } from '@libs/harness/driver-gestures';
import { Handles } from '@libs/test-ids-shared/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
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

function googleAuthorizationUrl(url: string): URL | null {
  try {
    let parsed = new URL(url);
    // Google can replace the authorization endpoint with its account chooser.
    // That page carries the original request directly or in `continue`.
    for (let hop = 0; hop < 4; hop += 1) {
      if (parsed.hostname !== 'accounts.google.com') return null;
      if (parsed.searchParams.has('redirect_uri')) return parsed;
      const next = parsed.searchParams.get('continue');
      if (next === null) return null;
      parsed = new URL(next);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The current tab hands the person to Google with our callback. It stops at
 * Google's door: a real Google account cannot be scripted.
 */
export async function expectGoogleHandOff(
  browser: JourneyBrowser
): Promise<void> {
  const authorize = googleAuthorizationUrl(
    await browser.waitForNavigation(
      (url) => googleAuthorizationUrl(url) !== null,
      JOURNEY_WAIT_MS
    )
  );
  if (authorize === null)
    throw new Error('Google authorization URL is missing');
  check(
    authorize.searchParams.get('response_type') === 'code',
    'Google was not asked for an authorization code'
  );
  check(
    (authorize.searchParams.get('state') ?? '').length > 0,
    'Google was not given the state needed to return to the app'
  );
  const expected = `${browser.oauthCallbackOrigin}/api/auth/callback/google`;
  const redirectUri = authorize.searchParams.get('redirect_uri');
  check(
    redirectUri === expected,
    `Google redirect_uri is ${String(redirectUri)}, expected ${expected}`
  );
}
