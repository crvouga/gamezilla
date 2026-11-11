import { expect, type Page, test } from '@playwright/test';

async function panelTop(page: Page, story: string) {
  await page.goto(
    `/iframe.html?id=screens-puzzles-content-attempt-progress--${story}&viewMode=story`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  const panel = await page.getByTestId('puzzle-attempt-panel').boundingBox();
  if (!panel) throw new Error('The pack card is missing');
  return Math.round(panel.y);
}

// regression: puzzle-solved-way-on-moves-pack-card
// The pack card is on the attempt's progress screen.
test('storybook integration: solving a pack puzzle leaves its pack card in place', async ({
  page,
}) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await panelTop(page, 'pack-in-progress');
    const after = await panelTop(page, 'pack-completed');
    expect(after, `pack card at ${width}px`).toBe(before);
    await expect(page.getByTestId('content-next-puzzle')).toBeInViewport({
      ratio: 1,
    });
  }
});
