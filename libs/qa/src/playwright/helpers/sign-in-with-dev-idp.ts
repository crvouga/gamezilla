/**
 * Drives the in-repo dev IdP "Continue with test account" sign-in flow
 * end-to-end:
 *   1. Open the sign-in modal from the user menu.
 *   2. Click the dev button (`signInButtonTestId('dev')`).
 *   3. On the IdP account chooser, pick the named test account (creating
 *      it via the inline form when missing) and submit.
 *   4. Wait for the redirect back to `/sso-callback` and resolve.
 *
 * The helper relies exclusively on `data-testid` and `data-state`
 * attributes published by `pkgs/dev-idp/src/ui` (see the
 * "Testing contract" comment at the top of that file). Anything visual
 * in the IdP can change without touching this helper.
 *
 * The helper is intentionally tolerant of pre-existing test accounts:
 * the IdP store persists across runs, so callers should pick a
 * deterministic email and rely on idempotent create-if-missing.
 */
import type { Page } from '@playwright/test';

export type DevIdpTestAccount = {
  readonly name: string;
  readonly email: string;
};

const DEFAULT_TEST_ACCOUNT: DevIdpTestAccount = {
  name: 'Playwright Tester',
  email: 'playwright@example.com',
};

/**
 * Performs the full dev sign-in flow. Returns once the SPA has been
 * redirected back to the app post-callback (signaled by `/sso-callback`
 * leaving the URL).
 */
export async function signInWithDevIdp(
  page: Page,
  account: DevIdpTestAccount = DEFAULT_TEST_ACCOUNT
): Promise<void> {
  await openSignInModal(page);
  await page
    .getByRole('button', { name: /sign in with test account/i })
    .click();
  // The dev IdP is a standalone server (see `@pkgs/dev-idp/dev-server.ts`);
  // Better Auth redirects the browser to its origin (default
  // `http://127.0.0.1:5556`), so the URL path is just `/dev-idp/authorize`
  // without the API origin in front.
  await page.waitForURL(/\/dev-idp\/authorize/, { timeout: 30_000 });

  await waitForListReady(page);
  await ensureTestAccount(page, account);

  // The whole row is the click target (mirrors Google's account chooser).
  // We filter by `data-email` so the row matches regardless of rendered
  // text changes or future i18n.
  await page
    .getByTestId('dev-idp-account-row')
    .filter({ has: page.locator(`[data-email="${account.email}"]`) })
    .first()
    .click();

  await page.waitForURL((url) => !url.pathname.startsWith('/dev-idp/'), {
    timeout: 30_000,
  });
}

async function openSignInModal(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: /sign in/i }).first();
  await trigger.click({ timeout: 30_000 });
}

/**
 * Waits for the account list to finish loading. The list publishes
 * `data-state="loading|loaded|empty|error"` on the `<section>`, so we
 * just block until it leaves `loading`.
 */
async function waitForListReady(page: Page): Promise<void> {
  const list = page.getByTestId('dev-idp-account-list');
  await list.waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector(
        '[data-testid="dev-idp-account-list"]'
      );
      const state = el?.getAttribute('data-state');
      return state === 'loaded' || state === 'empty' || state === 'error';
    },
    null,
    { timeout: 30_000 }
  );
}

async function ensureTestAccount(
  page: Page,
  account: DevIdpTestAccount
): Promise<void> {
  const existing = page
    .getByTestId('dev-idp-account-row')
    .filter({ has: page.locator(`[data-email="${account.email}"]`) });
  if ((await existing.count()) > 0) return;

  await page.getByTestId('dev-idp-add-account-trigger').click();
  await page.getByTestId('dev-idp-create-name').fill(account.name);
  await page.getByTestId('dev-idp-create-email').fill(account.email);
  await page.getByTestId('dev-idp-create-submit').click();
  await existing.first().waitFor({ state: 'visible', timeout: 10_000 });
}
