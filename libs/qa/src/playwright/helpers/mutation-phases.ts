import { expect, type Page } from '@playwright/test';

/** Sign-in modal entered the OAuth handoff loading state. */
export async function expectSignInModalLoading(page: Page): Promise<void> {
  await expect(page.getByText('Signing in…')).toBeVisible({ timeout: 10_000 });
}

/** Sign-in modal re-opened after OAuth redirect (loading or success). */
export async function expectSignInModalResumed(page: Page): Promise<void> {
  await expect(
    page
      .getByText('Signing in…')
      .or(page.getByText('Signed in', { exact: true }))
  ).toBeVisible({ timeout: 60_000 });
}

/** Sign-in modal shows the post-callback success state. */
export async function expectSignInModalSuccess(page: Page): Promise<void> {
  await expect(page.getByText('Signed in', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("You're signed in on this device.")
  ).toBeVisible();
  await expect(page.getByText('Done')).toBeVisible();
}

/** Dismisses the sign-in success modal via Done. */
export async function dismissSignInModalSuccess(page: Page): Promise<void> {
  await page.getByText('Done').click();
  await expect(page.getByText('Signed in', { exact: true })).toHaveCount(0, {
    timeout: 10_000,
  });
}

/** Sign-out confirmation modal is showing its idle copy. */
export async function expectSignOutConfirmIdle(page: Page): Promise<void> {
  await expect(page.getByText('Sign out?')).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText('You will need to sign in again to sync with your user.')
  ).toBeVisible();
}

/** Submits the destructive sign-out confirm (idle modal must be visible). */
export async function confirmSignOut(page: Page): Promise<void> {
  await expectSignOutConfirmIdle(page);
  await page
    .getByRole('dialog')
    .getByText('Sign out', { exact: true })
    .click();
}

/** Sign-out modal shows the in-flight loading state. */
export async function expectSignOutModalLoading(page: Page): Promise<void> {
  await expect(page.getByText('Signing out…')).toBeVisible({ timeout: 15_000 });
}

/** Sign-out modal shows the dismissible success state. */
export async function expectSignOutModalSuccess(page: Page): Promise<void> {
  await expect(page.getByText('Signed out', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("You're signed out on this device.")
  ).toBeVisible();
  await expect(page.getByText('Done')).toBeVisible();
}

/** Dismisses the sign-out success modal via Done. */
export async function dismissSignOutModalSuccess(page: Page): Promise<void> {
  await page.getByText('Done').click();
  await expect(page.getByText('Signed out', { exact: true })).toHaveCount(0, {
    timeout: 10_000,
  });
}
