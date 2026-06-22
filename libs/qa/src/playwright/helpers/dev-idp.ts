import { expect, type Page } from '@playwright/test';

export type DevIdpTestAccount = {
  readonly name: string;
  readonly email: string;
};

const CREATE_PANEL = 'dev-idp-create-panel';

/**
 * Sign-in handoff to the dev IdP has begun.
 *
 * Clicking the dev provider flips the modal to its `loading` ("Signing in…")
 * state and then immediately redirects the page (`window.location.href`) to the
 * dev IdP chooser. On fast machines the navigation preempts the browser paint
 * of that transient caption, so accept either the loading modal or the chooser
 * page the redirect lands on — whichever wins the race.
 */
export async function expectDevIdpHandoffStarted(page: Page): Promise<void> {
  await expect(
    page.getByText('Signing in…').or(page.getByTestId('dev-idp-page'))
  ).toBeVisible({ timeout: 30_000 });
}

/** Asserts the dev IdP authorize chooser is showing. */
export async function expectDevIdpChooser(page: Page): Promise<void> {
  const chooser = page.getByTestId('dev-idp-page');
  try {
    await expect(chooser).toBeVisible({ timeout: 30_000 });
  } catch (err) {
    if (await page.getByText('Internal Server Error').isVisible()) {
      throw new Error(
        'Dev IdP authorize returned 500 — stop `bun run dev` or free DEV_IDP_PORT, then re-run `bun run qa:browser`',
        { cause: err }
      );
    }
    if (await page.getByText('Sign-in failed', { exact: true }).isVisible()) {
      const dialogText =
        (await page.getByRole('dialog').textContent())?.trim() ?? '';
      throw new Error(
        dialogText.length > 0
          ? `OAuth redirect to dev IdP did not occur (sign-in modal: ${dialogText})`
          : 'OAuth redirect to dev IdP did not occur (sign-in modal shows Sign-in failed).',
        { cause: err }
      );
    }
    throw err;
  }
}

/** Waits until the dev IdP account chooser finishes loading. */
export async function waitForDevIdpAccountListReady(page: Page): Promise<void> {
  await expect(page.getByTestId('dev-idp-account-list')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('dev-idp-account-list-loading')).toHaveCount(
    0,
    {
      timeout: 30_000,
    }
  );
  await expect(
    page
      .getByTestId('dev-idp-account-row')
      .first()
      .or(page.getByTestId('dev-idp-account-list-empty'))
      .or(page.getByTestId('dev-idp-account-list-error'))
  ).toBeVisible({ timeout: 10_000 });
}

/** Clicks the first account row on the dev IdP chooser. */
export async function pickFirstDevIdpAccount(page: Page): Promise<void> {
  await waitForDevIdpAccountListReady(page);
  const row = page.getByTestId('dev-idp-account-row').first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.click();
}

function devIdpAccountRow(page: Page, email: string) {
  return page.locator(
    `[data-testid="dev-idp-account-row"][data-email="${email}"]`
  );
}

/** Clicks an account row matching `data-email`, creating it when missing. */
export async function pickDevIdpAccount(
  page: Page,
  account: DevIdpTestAccount
): Promise<void> {
  await waitForDevIdpAccountListReady(page);
  await ensureDevIdpTestAccount(page, account);
  await devIdpAccountRow(page, account.email).click();
}

async function ensureDevIdpTestAccount(
  page: Page,
  account: DevIdpTestAccount
): Promise<void> {
  const existing = devIdpAccountRow(page, account.email);
  if ((await existing.count()) > 0) return;

  await page.getByTestId('dev-idp-add-account-trigger').click();
  await expect(page.getByTestId(CREATE_PANEL)).toBeVisible({ timeout: 10_000 });
  await page.getByTestId(`${CREATE_PANEL}-name`).fill(account.name);
  await page.getByTestId(`${CREATE_PANEL}-email`).fill(account.email);
  await page.getByTestId(`${CREATE_PANEL}-submit`).click();
  await expect(page.getByTestId(CREATE_PANEL)).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(existing).toBeVisible({ timeout: 30_000 });
}

/** Asserts the dev IdP chooser is gone after account selection. */
export async function expectLeftDevIdpChooser(page: Page): Promise<void> {
  await expect(page.getByTestId('dev-idp-page')).toHaveCount(0, {
    timeout: 30_000,
  });
}
