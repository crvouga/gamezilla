import { expect, test } from '@playwright/test';

for (const [width, height] of [
  [390, 844],
  [768, 1024],
  [1440, 900],
] as const) {
  for (const theme of ['light', 'dark']) {
    // regression: boot-recovery-reset-without-confirmation
    test(`storybook integration: local reset is explicit at ${width}/${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto(
        `/iframe.html?id=screens-shell-local-database-boot-error--open-in-another-tab&viewMode=story&globals=theme:${theme}`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      await expect(
        page.getByRole('button', { name: 'Reload app' })
      ).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Reset local data', exact: true })
        .click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Changes that have not synced');
      await expect(dialog).toContainText('permanently lost');
      const confirm = dialog.getByRole('button', { name: 'Reset and reload' });
      const bounds = await confirm.boundingBox();
      expect(bounds).not.toBeNull();
      expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(
        height
      );
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Reload app' })
      ).toBeVisible();
    });
  }
}
