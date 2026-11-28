import { expect, type Locator, test } from '@playwright/test';

async function expectUnclipped(control: Locator) {
  await expect(control).toBeVisible();
  expect(
    await control.evaluate((element) => {
      const box = element.getBoundingClientRect();
      let left = 0;
      let top = 0;
      let right = window.innerWidth;
      let bottom = window.innerHeight;
      for (
        let parent = element.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent);
        const bounds = parent.getBoundingClientRect();
        if (style.overflowX !== 'visible') {
          left = Math.max(left, bounds.left + parent.clientLeft);
          right = Math.min(
            right,
            bounds.left + parent.clientLeft + parent.clientWidth
          );
        }
        if (style.overflowY !== 'visible') {
          top = Math.max(top, bounds.top + parent.clientTop);
          bottom = Math.min(
            bottom,
            bounds.top + parent.clientTop + parent.clientHeight
          );
        }
      }
      return (
        box.left >= left &&
        box.right <= right &&
        box.top >= top &&
        box.bottom <= bottom
      );
    })
  ).toBe(true);
}

// regression: storybook-header-compact-viewport
for (const state of [
  'spaces-current',
  'search-current',
  'notifications-current',
  'profile-current',
  'with-account-menu',
  'select-profile',
]) {
  for (const width of [1024, 1440]) {
    test(`storybook integration: header ${state} exposes every navigation control at supported width ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(
        `/iframe.html?id=screens-shell-header-island--${state}&viewMode=story`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      const navigation = page.getByRole('navigation', { name: 'Navigation' });
      await expect(navigation.getByRole('button')).toHaveCount(4);
      for (const name of ['Spaces', 'Search', 'Notifications', 'Profile']) {
        await expectUnclipped(
          navigation.getByRole('button', { name, exact: true })
        );
      }
      if (state === 'with-account-menu') {
        await expectUnclipped(
          page.getByRole('button', { name: 'Account menu', exact: true })
        );
      }
    });
  }
}

// regression: desktop-sidebar-account-overflow
test('storybook integration: aligned desktop account row contains the longest valid handle', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const [story, handle] of [
    ['sidebar-player-account', '@DominantLeopon123'],
    ['sidebar-longest-account', '@' + 'W'.repeat(32)],
  ] as const) {
    await page.goto(
      `/iframe.html?id=screens-shell-header-island--${story}&viewMode=story`
    );
    const rail = page.locator('[data-region="rail"]');
    const row = rail.getByRole('button', { name: 'Spaces', exact: true });
    const account = rail.getByRole('button', {
      name: handle + ', account menu',
    });
    const label = account.getByText(handle, { exact: true });
    await expect(label).toBeVisible();
    const left = (element: Locator) =>
      element.evaluate((node) => node.getBoundingClientRect().left);
    expect(await left(account)).toBe(await left(row));
    expect(await left(account.locator('[data-component="Avatar"]'))).toBe(
      await left(row.locator('[data-slot="tile"]'))
    );
    expect(await left(label)).toBe(await left(row.getByText('Spaces')));
    expect(
      await account.evaluate((node) => node.getBoundingClientRect().right)
    ).toBe(await row.evaluate((node) => node.getBoundingClientRect().right));
    expect(await rail.evaluate((node) => node.scrollWidth)).toBe(
      await rail.evaluate((node) => node.clientWidth)
    );
    if (story === 'sidebar-longest-account') {
      expect(
        await label.evaluate((node) => node.scrollWidth > node.clientWidth)
      ).toBe(true);
      await expect(label).toHaveCSS('text-overflow', 'ellipsis');
    }
    await page.screenshot({
      path: info.outputPath(story + '.png'),
      animations: 'disabled',
    });
    await account.focus();
    await account.press('Enter');
    await expect(page.getByText(handle, { exact: true }).last()).toBeVisible();
    await expect(account).toHaveAttribute('aria-expanded', 'true');
  }
});
