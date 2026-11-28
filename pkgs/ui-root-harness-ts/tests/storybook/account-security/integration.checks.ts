import { expect, test } from '@playwright/test';

// regression: account-sign-out-target-moves-during-sync
test('account security keeps Sign out under the same tap while sign-in methods load', async ({
  page,
}, info) => {
  for (const size of [
    { width: 390, height: 757 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    const signOut = page.getByTestId('account-sign-out');
    let tap: { x: number; y: number } | undefined;
    for (const state of [
      'methods-loading',
      'signed-in',
      'methods-sync-failed',
    ]) {
      await page.goto(
        `/iframe.html?id=screens-account--${state}&viewMode=story`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      await page.evaluate(() => document.fonts.ready);
      await expect(signOut).toBeInViewport({ ratio: 1 });
      const box = await signOut.boundingBox();
      if (!box) throw new Error('Sign out has no visible target');
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      tap ??= center;
      expect(center).toEqual(tap);
      expect(
        await signOut.evaluate(
          (button, point) =>
            button.contains(document.elementFromPoint(point.x, point.y)),
          tap
        )
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`account-${state}-${size.width}.png`),
        animations: 'disabled',
      });
    }
  }
});
