import { expect, type Page } from '@playwright/test';

/** Sign-in modal re-opened after OAuth redirect (loading or success). */
export async function expectSignInModalResumed(page: Page): Promise<void> {
  await expect(
    page
      .getByText('Signing in…')
      .or(page.getByText('Signed in', { exact: true }))
      .or(page.getByText('Sign-in failed', { exact: true }))
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

/** Clicks the primary submit action in an open {@link MutationModal} idle phase. */
async function clickMutationModalSubmit(
  page: Page,
  label: string
): Promise<void> {
  const dialogs = page.getByRole('dialog');
  const dialogCount = await dialogs.count();
  // Newest dialog first — mobile bottom sheets may expose `dialog` while
  // footer buttons sit outside that subtree in the a11y tree.
  for (let i = dialogCount - 1; i >= 0; i -= 1) {
    const dialog = dialogs.nth(i);
    const submit = dialog.getByRole('button', { name: label, exact: true });
    if ((await submit.count()) > 0) {
      await expect(submit).toBeVisible({ timeout: 10_000 });
      await submit.click();
      return;
    }
    const textSubmit = dialog.getByText(label, { exact: true });
    if ((await textSubmit.count()) > 0) {
      await expect(textSubmit).toBeVisible({ timeout: 10_000 });
      await textSubmit.click();
      return;
    }
  }

  const submit = page.getByRole('button', { name: label, exact: true });
  await expect(submit).toBeVisible({ timeout: 10_000 });
  await submit.click();
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
  await clickMutationModalSubmit(page, 'Sign out');
}

/** Sign-out modal shows the in-flight loading state (or success if sign-out is instant). */
export async function expectSignOutModalLoading(page: Page): Promise<void> {
  await expect(
    page
      .getByText('Signing out…')
      .or(page.getByText('Signed out', { exact: true }))
  ).toBeVisible({ timeout: 15_000 });
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

/** Leave-space confirmation modal is showing its idle copy. */
export async function expectLeaveSpaceConfirmIdle(page: Page): Promise<void> {
  await expect(page.getByText('Leave space?')).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText('You can join again later if the space is still live.')
  ).toBeVisible();
}

/** Submits the leave-space confirm (idle modal must be visible). */
export async function confirmLeaveSpace(page: Page): Promise<void> {
  await expectLeaveSpaceConfirmIdle(page);
  await clickMutationModalSubmit(page, 'Leave');
}

/** Leave-space modal shows the in-flight loading state. */
export async function expectLeaveSpaceModalLoading(page: Page): Promise<void> {
  await expect(page.getByText('Leaving…')).toBeVisible({ timeout: 15_000 });
}

/** Leave-space modal shows the dismissible success state. */
export async function expectLeaveSpaceModalSuccess(page: Page): Promise<void> {
  await expect(
    page.getByText('You left the space', { exact: true })
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText(
      'You can rejoin from the invite link if the space is still live.'
    )
  ).toBeVisible();
  await expect(page.getByText('Done')).toBeVisible();
}

/** End-space confirmation modal is showing its idle copy. */
export async function expectEndSpaceConfirmIdle(page: Page): Promise<void> {
  await expect(page.getByText('End space?')).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText('Everyone will leave this space. This cannot be undone.')
  ).toBeVisible();
}

/** Submits the end-space confirm (idle modal must be visible). */
export async function confirmEndSpace(page: Page): Promise<void> {
  await expectEndSpaceConfirmIdle(page);
  await clickMutationModalSubmit(page, 'End space');
}

/** End-space modal shows the in-flight loading state. */
export async function expectEndSpaceModalLoading(page: Page): Promise<void> {
  await expect(page.getByText('Ending space…')).toBeVisible({
    timeout: 15_000,
  });
}

/** End-space modal shows the dismissible success state. */
export async function expectEndSpaceModalSuccess(page: Page): Promise<void> {
  await expect(page.getByText('Space ended', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText('Everyone has been returned to the lobby.')
  ).toBeVisible();
  await expect(page.getByText('Done')).toBeVisible();
}

/** Dismisses a space lifecycle success modal via Done. */
export async function dismissSpaceLifecycleModalSuccess(
  page: Page,
  successTitle: string
): Promise<void> {
  await page.getByText('Done').click();
  await expect(page.getByText(successTitle, { exact: true })).toHaveCount(0, {
    timeout: 10_000,
  });
}
