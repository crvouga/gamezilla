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
        `/iframe.html?id=screens-shell-header-island--${state}&viewMode=story&globals=theme:light`
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
