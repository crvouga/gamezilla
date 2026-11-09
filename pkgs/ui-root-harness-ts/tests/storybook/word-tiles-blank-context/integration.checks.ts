// @io-wall-ok — native story coverage for the public blank-assignment context.
import { expect, test } from '@playwright/test';
import { auditAccessibility, recordEvidence } from '../word-tiles/evidence';
import { retainEvidence } from '../word-tiles/retained-evidence';

test.use({ video: 'on', trace: 'on', viewport: { width: 320, height: 740 } });
test.afterEach(async ({ page }, info) => recordEvidence(page, info));

// regression: word-tiles-blank-context-missing-story
test('storybook integration: word-tiles blank context exposes its production states', async ({
  page,
}, info) => {
  for (const [story, range, theme] of [
    ['centre', 'e7 to k9', 'light'],
    ['top-left', 'a1 to g3', 'light'],
    ['bottom-right-long-summary', 'i13 to o15', 'light'],
    ['centre', 'e7 to k9', 'dark'],
    ['top-left', 'a1 to g3', 'dark'],
    ['bottom-right-long-summary', 'i13 to o15', 'dark'],
  ]) {
    await page.goto(
      `/iframe.html?id=games-word-tiles-blank-context--${story}&viewMode=story&globals=theme:${theme}`
    );
    await expect(page.locator('#storybook-root')).toHaveAttribute(
      'data-story-ready',
      'true'
    );
    await expect(page.getByText(`Nearby squares: ${range}`)).toBeVisible();
    await expect(
      page.locator('#storybook-root').getByRole('button')
    ).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await retainEvidence(info, `${story}-${theme}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await auditAccessibility(page, info);
  }
});
