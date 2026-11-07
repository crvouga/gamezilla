import { expect, type Locator, type Page, test } from '@playwright/test';

async function open(
  page: Page,
  state: string,
  viewport: { width: number; height: number },
  theme: string
) {
  await page.setViewportSize(viewport);
  await page.goto(
    `/iframe.html?id=screens-privacy--${state}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  if (value === null) throw new Error('Required privacy content is missing');
  return value;
}

// regression: privacy-outcome-and-refusal-below-explanation
for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
])
  for (const theme of ['light', 'dark']) {
    for (const state of ['deletion-needs-proof', 'deletion-offline'])
      test(`storybook integration: ${state} explains the failed choice in view at ${viewport.width}/${theme}`, async ({
        page,
      }) => {
        await open(page, state, viewport, theme);
        const action = await box(page.getByTestId('privacy-delete-review'));
        const denial = await box(page.getByTestId('privacy-delete-denial'));
        expect(action.y + action.height).toBeLessThanOrEqual(denial.y);
        expect(denial.y + denial.height).toBeLessThanOrEqual(viewport.height);
        await expect(
          page
            .getByTestId('privacy-deletion-task')
            .getByTestId('privacy-delete-denial')
        ).toHaveCount(1);
        await expect(page.getByTestId('privacy-delete-denial')).toContainText(
          state === 'deletion-needs-proof'
            ? 'Nothing has changed yet.'
            : 'nothing is saved to send later'
        );
      });
    for (const state of [
      'deletion-confirmed',
      'deletion-confirmed-cancellation-complete',
    ])
      test(`storybook integration: ${state} receipt is complete in view at ${viewport.width}/${theme}`, async ({
        page,
      }) => {
        await open(page, state, viewport, theme);
        const receipt = page
          .getByTestId('privacy-deletion-outcome')
          .locator('..');
        const bounds = await box(receipt);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
        await expect(receipt).toContainText('Account deletion was confirmed.');
        await expect(receipt).toContainText('complete by Dec 2, 2026.');
        await expect(receipt).not.toContainText('You are signed out.');
        await expect(
          page.getByTestId('privacy-cancellation-outcome')
        ).toHaveText(
          state.endsWith('cancellation-complete')
            ? 'Membership cancellation has completed.'
            : 'Membership cancellation is still being completed. Nothing more is needed from you.'
        );
      });
  }

test('storybook integration: privacy tasks precede the complete consequences and retention text', async ({
  page,
}) => {
  await open(page, 'no-export', { width: 390, height: 844 }, 'light');
  const exportAction = await box(page.getByTestId('privacy-export-request'));
  const deleteAction = await box(page.getByTestId('privacy-delete-review'));
  const explanation = page.getByTestId('privacy-consequences');
  const explanationBounds = await box(explanation);
  expect(exportAction.y + exportAction.height).toBeLessThan(deleteAction.y);
  expect(deleteAction.y + deleteAction.height).toBeLessThan(
    explanationBounds.y
  );
  for (const words of [
    'including offline devices when they reconnect',
    'Signing in later starts a new account.',
    'will be erased within 30 days',
    'the remaining paid time and Plus credit are not refunded',
    'Any membership payment taken after confirmed deletion will be refunded in full.',
    'for 7 years after payment',
    'Preserved information cannot restore a profile or be used to promote the product.',
  ])
    await expect(explanation).toContainText(words);
});

test('storybook integration: the applicable legal purpose remains beside the complete retention explanation', async ({
  page,
}) => {
  await open(page, 'legal-obligation', { width: 390, height: 844 }, 'light');
  const notice = page
    .getByTestId('privacy-retention')
    .getByTestId('privacy-legal-obligation');
  await expect(notice).toContainText('Tax audit for fiscal year 2025');
  await expect(notice).toContainText('until the audit closes or by 2027-06-30');
  await expect(page.getByTestId('privacy-legal-obligation')).toHaveCount(1);
});

// A prior device receipt must not suppress another current account's legitimate actions.
// Current permission decisions, independent of that receipt, own action availability.
test('storybook integration: a retained device receipt does not infer current-account permissions', async ({
  page,
}) => {
  await open(
    page,
    'receipt-with-current-account-actions',
    { width: 390, height: 844 },
    'light'
  );
  for (const id of [
    'privacy-delete-review',
    'privacy-export-request',
    'privacy-export-summary',
    'privacy-export-detail',
  ]) {
    await expect(page.getByTestId(id)).toHaveCount(1);
  }
  await expect(page.getByTestId('privacy-deletion-receipt')).not.toContainText(
    'You are signed out.'
  );
});

// regression: privacy-outcome-and-refusal-below-explanation
test('storybook integration: receiving a deletion receipt preserves confirm-first and its success acknowledgment', async ({
  page,
}) => {
  await open(
    page,
    'confirm-then-receipt',
    { width: 390, height: 844 },
    'light'
  );
  await expect(page.getByTestId('privacy-deletion-outcome')).toHaveCount(0);
  await page.getByTestId('privacy-delete-review').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('This cannot be undone.');
  await expect(dialog).toContainText(
    'the remaining paid time and Plus credit are not refunded'
  );
  await expect(page.getByTestId('privacy-deletion-outcome')).toHaveCount(0);
  await page.getByTestId('privacy-delete-confirm').click();
  await expect(dialog).toContainText('Account deletion confirmed');
  await expect(page.getByTestId('privacy-deletion-outcome')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('privacy-deletion-outcome')).toContainText(
    'complete by Dec 2, 2026.'
  );
  await expect(page.getByTestId('privacy-delete-review')).toHaveCount(0);
  await expect(page.getByTestId('privacy-export-request')).toHaveCount(0);
});

// regression: privacy-current-access-obsolete-actions
for (const width of [390, 768, 1440])
  for (const theme of ['light', 'dark']) {
    for (const state of [
      'receipt-with-unavailable-actions',
      'access-needs-proof',
      'access-offline',
    ])
      test(`storybook integration: ${state} shows the configured access choice at ${width}/${theme}`, async ({
        page,
      }) => {
        await open(page, state, { width, height: 900 }, theme);
        await expect(page.getByTestId('privacy-export-request')).toHaveCount(0);
        await expect(page.getByTestId('privacy-delete-review')).toHaveCount(0);
        for (const id of ['privacy-export-access', 'privacy-delete-access']) {
          await expect(page.getByTestId(id)).toBeVisible();
          if (state === 'access-offline') {
            await expect(page.getByTestId(id)).toContainText(
              'This choice needs a connection'
            );
            await expect(page.getByTestId(`${id}-action`)).toHaveCount(0);
          } else {
            await expect(page.getByTestId(`${id}-action`)).toHaveAccessibleName(
              'Sign in'
            );
          }
        }
        if (state === 'receipt-with-unavailable-actions')
          await expect(
            page.getByTestId('privacy-deletion-receipt')
          ).toContainText('Account deletion was confirmed.');
      });
  }
