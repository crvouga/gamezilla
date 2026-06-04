import { expect, type Page } from '@playwright/test';

export type DevIdpTestAccount = {
  readonly name: string;
  readonly email: string;
};

const CREATE_PANEL = 'dev-idp-create-panel';

/** Asserts the dev IdP authorize chooser is showing. */
export async function expectDevIdpChooser(page: Page): Promise<void> {
  const chooser = page.getByTestId('dev-idp-page');
  try {
    await expect(chooser).toBeVisible({ timeout: 30_000 });
  } catch (err) {
    if (await page.getByText('Sign-in failed').isVisible()) {
      throw new Error(
        'OAuth redirect to dev IdP did not occur (sign-in modal shows Sign-in failed).',
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

/** Clicks an account row matching `data-email`, creating it when missing. */
export async function pickDevIdpAccount(
  page: Page,
  account: DevIdpTestAccount
): Promise<void> {
  await waitForDevIdpAccountListReady(page);
  await ensureDevIdpTestAccount(page, account);
  await page
    .getByTestId('dev-idp-account-row')
    .filter({ has: page.locator(`[data-email="${account.email}"]`) })
    .first()
    .click();
}

async function ensureDevIdpTestAccount(
  page: Page,
  account: DevIdpTestAccount
): Promise<void> {
  const existing = page
    .getByTestId('dev-idp-account-row')
    .filter({ has: page.locator(`[data-email="${account.email}"]`) });
  if ((await existing.count()) > 0) return;

  await page.getByTestId('dev-idp-add-account-trigger').click();
  await page.getByTestId(`${CREATE_PANEL}-name`).fill(account.name);
  await page.getByTestId(`${CREATE_PANEL}-email`).fill(account.email);
  await page.getByTestId(`${CREATE_PANEL}-submit`).click();
  await existing.first().waitFor({ state: 'visible', timeout: 10_000 });
}

/** Asserts the dev IdP chooser is gone after account selection. */
export async function expectLeftDevIdpChooser(page: Page): Promise<void> {
  await expect(page.getByTestId('dev-idp-page')).toHaveCount(0, {
    timeout: 30_000,
  });
}
