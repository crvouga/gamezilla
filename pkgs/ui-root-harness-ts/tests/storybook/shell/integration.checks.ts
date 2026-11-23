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
  await open(page, 'screens-spaces-home--populated', 390);
  await expect(
    page.getByRole('navigation', { name: 'Navigation' })
  ).toBeVisible();
  await expect(page.getByTestId('tab-spaces')).toBeVisible();
  await expect(page.getByTestId('tab-profile')).toBeVisible();
  await expect(page.locator('[data-region="rail"]')).toHaveCount(0);
});

for (const id of [
  'screens-spaces-home--populated',
  'screens-space-home--host-choosing',
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

// regression: storybook-space-home-two-space-headers
test('storybook integration: screens-space-home--host-choosing has exactly one real compact space header', async ({
  page,
}) => {
  await open(page, 'screens-space-home--host-choosing', 390);
  // One top bar, which says what the screen is and is the space's alone:
  // the app's account menu stays outside a space.
  await expect(page.getByTestId('space-title')).toHaveCount(1);
  await expect(page.getByTestId('space-title')).toHaveText('Choose game');
  const bar = page.locator('[data-space-row="actions"]');
  await expect(bar).toHaveCount(1);
  await expect(
    bar.getByRole('button', { name: 'Account menu', exact: true })
  ).toHaveCount(0);
  // Which space it is heads the space menu.
  await bar.getByRole('button', { name: 'Space menu' }).click();
  await expect(page.getByTestId('space-menu-name')).toHaveText(
    'Friday game night'
  );
  await expect(page.locator('[data-component="AppTabBar"]')).toHaveCount(0);
});

test('storybook integration: a stack route keeps its header without bottom tabs', async ({
  page,
}) => {
  await open(page, 'screens-settings-appearance--system', 390);
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  await expect(page.locator('[data-component="AppTabBar"]')).toHaveCount(0);
});
