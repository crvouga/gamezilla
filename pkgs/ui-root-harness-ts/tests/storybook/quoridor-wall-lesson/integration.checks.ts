import { expect, type Page, test } from '@playwright/test';
import { expectQuoridorStoryPasses } from '../quoridor-overhaul/evidence';

async function tapWallGap(page: Page, touch: boolean) {
  const square = (cell: string) =>
    page.getByTestId(`practice-board-action-${cell}`);
  await square('d6').scrollIntoViewIfNeeded();
  const lower = await square('d6').boundingBox();
  const upper = await square('d7').boundingBox();
  if (!lower || !upper)
    throw new Error('The d6 and d7 squares must be visible');
  const x = lower.x + lower.width * 0.75;
  const y = (upper.y + upper.height + lower.y) / 2;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test('storybook integration: Quoridor wall lesson story places the wall', async ({
  page,
}) => {
  await expectQuoridorStoryPasses(
    page,
    'screens-game-home-how-to-play--place-a-wall'
  );
  await expect(page.getByTestId('practice-next')).toBeEnabled();
});

for (const [mode, goal] of [
  ['quoridor', 'Move to e9'],
  ['quoridor-hill', 'star on e5'],
] as const) {
  const touch = mode === 'quoridor-hill';
  test.describe(mode, () => {
    test.use({
      hasTouch: touch,
      viewport: touch
        ? { width: 390, height: 844 }
        : { width: 1080, height: 1000 },
    });
    // regression: quoridor-lesson-wall-controls
    test('storybook integration: Quoridor wall lesson advances after a direct placement and retry', async ({
      page,
    }, info) => {
      await page.goto(
        `/iframe.html?id=screens-game-home-how-to-play--first-move&args=gameId:${mode}&viewMode=story`
      );
      const ui = (id: string) => page.getByTestId(`practice-${id}`);
      const next = ui('next');
      const prompt = ui('prompt');
      const d6 = ui('board-action-d6');
      const e6 = ui('board-action-e6');
      await ui('board-action-e2').click();
      await next.click();
      await expect(prompt).toContainText('gap above the right half of d6');
      await tapWallGap(page, touch);
      await expect(d6).toHaveAttribute('data-preview-edge-top', 'true');
      await expect(next).toHaveCount(0);
      await ui('retry').click();
      await expect(d6).not.toHaveAttribute('data-preview-edge-top', 'true');
      await expect(d6).not.toHaveAttribute('data-edge-top', 'true');
      await expect(next).toHaveCount(0);
      await tapWallGap(page, touch);
      await expect(e6).toHaveAttribute('data-preview-edge-top', 'true');
      await prompt.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`${mode}-preview.png`) });
      await tapWallGap(page, touch);
      await expect(d6).toHaveAttribute('data-edge-top', 'true');
      await expect(e6).toHaveAttribute('data-edge-top', 'true');
      await expect(prompt).toContainText('The wall blocks two crossings');
      await expect(next).toBeEnabled();
      await prompt.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`${mode}-placed.png`) });
      await next.click();
      await expect(prompt).toContainText(goal);
      await page.screenshot({ path: info.outputPath(`${mode}-next.png`) });
    });
  });
}
