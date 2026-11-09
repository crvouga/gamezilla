import { expect, type Page, type TestInfo } from '@playwright/test';
import { captureChessState, openChessStory, squareCenter } from './evidence';

/** Records the same click-only gesture on baseline and candidate without hiding failures. */
export async function captureAssistiveActivation(
  page: Page,
  info: TestInfo,
  theme: string
) {
  await openChessStory(page, 'product-chessboard--initial', theme);
  await page.locator('[data-square="e2"]').evaluate((node) => {
    (node as HTMLButtonElement).click();
  });
  await captureChessState(page, info, 'assistive-source');
  await page.locator('[data-square="e4"]').evaluate((node) => {
    (node as HTMLButtonElement).click();
  });
  const taskCompleted =
    (await page
      .getByRole('button', {
        name: 'e4, White pawn',
        exact: true,
      })
      .count()) === 1;
  await captureChessState(page, info, 'assistive-destination');
  await info.attach('assistive-task-result', {
    body: JSON.stringify({
      task: 'Move e2 to e4 with click-only activation',
      taskCompleted,
      limit:
        'DOM click activation, not a recording of a physical screen reader.',
    }),
    contentType: 'application/json',
  });
  expect(taskCompleted).toBe(true);
}

export async function capturePromotion(
  page: Page,
  info: TestInfo,
  theme: string
) {
  await openChessStory(page, 'product-chessboard--promotion', theme);
  for (const square of ['a7', 'a8']) {
    const point = await squareCenter(page, square);
    await page.mouse.click(point.x, point.y);
  }
  await expect(
    page.getByRole('button', { name: 'Queen', exact: true })
  ).toBeFocused();
  await captureChessState(page, info, 'promotion-choices');
  await page.keyboard.press('Shift+Tab');
  const reverseTabTarget = await page.evaluate(() =>
    document.activeElement?.getAttribute('aria-label')
  );
  await info.attach('promotion-focus-result', {
    body: JSON.stringify({
      reverseTabTarget,
      taskCompleted: reverseTabTarget === 'Cancel promotion',
    }),
    contentType: 'application/json',
  });
  // Resume from a named choice even when the baseline lets Tab escape.
  await page.getByRole('button', { name: 'Queen', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'a7, White pawn' })
  ).toBeFocused();
  await captureChessState(page, info, 'promotion-cancelled');
  for (const square of ['a7', 'a8']) {
    const point = await squareCenter(page, square);
    await page.mouse.click(point.x, point.y);
  }
  await page.getByRole('button', { name: 'Knight', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'a8, White knight' })
  ).toBeFocused();
  await captureChessState(page, info, 'underpromotion');
  expect(reverseTabTarget).toBe('Cancel promotion');
}
