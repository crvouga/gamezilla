import { test } from '@playwright/test';

import { createAppSession } from '../dsl/app-session';
import {
  createQaPlaywrightLog,
  playwrightStep,
} from '../logging/playwright-step';

test('sign in and sign out with dev-idp', async ({ page }, testInfo) => {
  const log = createQaPlaywrightLog(testInfo);
  const app = createAppSession(page);

  await playwrightStep(log, 'boot: app shell ready', () => app.expectBooted());
  await playwrightStep(log, 'auth: sign in with dev-idp', () =>
    app.auth.signInWithDevIdp()
  );
  await playwrightStep(log, 'auth: dismiss sign-in success', () =>
    app.auth.dismissSignInSuccess()
  );
  await playwrightStep(log, 'auth: sign out', () => app.auth.signOut());
  await playwrightStep(log, 'auth: assert signed out', () =>
    app.auth.expectSignedOut()
  );
});
