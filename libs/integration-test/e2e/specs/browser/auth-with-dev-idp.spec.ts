import { test } from '@playwright/test';

import { expectAppBooted } from '../../../src/app-boot';
import {
  createQaPlaywrightLog,
  playwrightStep,
} from '../../../src/playwright-step';

import { AuthDSL } from '../../dsl/auth';

test('sign in and sign out with dev-idp', async ({ page }, testInfo) => {
  const log = createQaPlaywrightLog(testInfo);
  const auth = new AuthDSL(page);

  await playwrightStep(log, 'boot: app shell ready', () =>
    expectAppBooted(page)
  );
  await playwrightStep(log, 'auth: sign in with dev-idp', () =>
    auth.signInWithDevIdp()
  );
  await playwrightStep(log, 'auth: dismiss sign-in success', () =>
    auth.dismissSignInSuccess()
  );
  await playwrightStep(log, 'auth: sign out', () => auth.signOut());
  await playwrightStep(log, 'auth: assert signed out', () =>
    auth.expectSignedOut()
  );
});
