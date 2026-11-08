import { expect, type Page, type TestInfo } from '@playwright/test';
import { accessibility, capture, counts, openSokoban } from './evidence';
import { measureSokoban } from './responsiveness';

/** Where the player's hand rests, in page coordinates: the pad and undo. */
async function controlTops(page: Page) {
  const pad = page.getByTestId('sokoban-move-up');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const top = (element: Element) =>
    Math.round(element.getBoundingClientRect().top + window.scrollY);
  return { pad: await pad.evaluate(top), undo: await undo.evaluate(top) };
}

export async function solveAndRecover(
  page: Page,
  info: TestInfo,
  viewport: { width: number; height: number },
  theme: string
) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openSokoban(page, 'puzzle--fresh', theme);
  await capture(page, info, 'fresh');
  const resting = await controlTops(page);
  const board = page.getByTestId('sokoban-board');
  await board.focus();
  await board.press('ArrowLeft');
  await expect(page.getByTestId('sokoban-refusal')).toBeVisible();
  await counts(page, 0, 0);
  // regression: sokoban-feedback-moves-controls
  expect(await controlTops(page)).toEqual(resting);
  await capture(page, info, 'blocked');
  await board.press('ArrowRight');
  await board.press('d');
  await counts(page, 2, 2);
  await capture(page, info, 'first-crate-on-goal');
  await measureSokoban(page, info, viewport.width === 390 ? 4 : 1);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await counts(page, 0, 0);
  await board.focus();
  await board.press('ArrowRight');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await counts(page, 0, 0);
  await expect(page.getByTestId('sokoban-refusal')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await counts(page, 1, 1);
  await board.focus();
  for (const key of ['d', 'a', 'a', 'w', 'd', 'd']) await board.press(key);
  await counts(page, 7, 4);
  await expect(page.getByTestId('sokoban-solved')).toBeVisible();
  expect(await controlTops(page)).toEqual(resting);
  await expect(page.getByTestId('sokoban-move-down')).toBeInViewport({
    ratio: 1,
  });
  await capture(page, info, 'solved');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await counts(page, 0, 0);
  await expect(page.getByTestId('sokoban-solved')).toHaveCount(0);
  await capture(page, info, 'restarted');
  await accessibility(page, info);
  expect(errors).toEqual([]);
}
