import { expect, type Page, test } from '@playwright/test';

async function open(page: Page, id: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:light`);
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
}

// regression: storybook-screen-missing-product-navigation
test('storybook integration: the compact lobby keeps the production bottom tabs', async ({
  page,
}) => {
  await open(page, 'screens-spaces-lobby--populated', 390);
  await expect(
    page.getByRole('navigation', { name: 'Navigation' })
  ).toBeVisible();
  await expect(page.getByTestId('tab-spaces')).toBeVisible();
  await expect(page.getByTestId('tab-profile')).toBeVisible();
  await expect(page.locator('[data-region="rail"]')).toHaveCount(0);
});

for (const id of [
  'screens-spaces-lobby--populated',
  'screens-spaces-games--host-choosing',
]) {
  test(`storybook integration: ${id} keeps the production desktop sidebar`, async ({
    page,
  }) => {
    await open(page, id, 1440);
    const rail = page.locator('[data-region="rail"]');
    await expect(rail).toBeVisible();
    await expect(rail.getByTestId('tab-spaces')).toBeVisible();
    await expect(
      rail.getByRole('button', { name: '@avery, account menu' })
    ).toBeVisible();
    await expect(page.locator('[data-component="AppTabBar"]')).toHaveCount(0);
  });
}

for (const id of [
  'screens-spaces-games--host-choosing',
  'screens-spaces-detail--host-choosing-game',
]) {
  test(`storybook integration: ${id} has exactly one real compact space header`, async ({
    page,
  }) => {
    await open(page, id, 390);
    await expect(page.getByTestId('space-title')).toHaveCount(1);
    await expect(page.getByTestId('space-title')).toContainText(
      'Friday game night'
    );
    await expect(
      page.getByRole('button', { name: 'Account menu', exact: true })
    ).toBeVisible();
    await expect(page.locator('[data-component="AppTabBar"]')).toHaveCount(0);
  });
}

test('storybook integration: a stack route keeps its header without bottom tabs', async ({
  page,
}) => {
  await open(page, 'screens-settings-appearance--system', 390);
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  await expect(page.locator('[data-component="AppTabBar"]')).toHaveCount(0);
});
