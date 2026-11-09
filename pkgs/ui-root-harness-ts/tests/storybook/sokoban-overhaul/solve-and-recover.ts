import { expect, type Page, type TestInfo } from '@playwright/test';
import { contrast } from './contrast';
import { accessibility, capture, counts, openSokoban } from './evidence';
import { measureSokoban, pushAndUndo, walking } from './responsiveness';

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
  // Every state is scanned at every viewport, with measured text contrast.
  await accessibility(page, info, 'fresh');
  await contrast(page, info, 'fresh');
  const resting = await controlTops(page);
  const board = page.getByTestId('sokoban-board');
  await board.focus();
  await board.press('ArrowLeft');
  await expect(page.getByTestId('sokoban-refusal')).toBeVisible();
  await counts(page, 0, 0);
  // regression: sokoban-feedback-moves-controls
  expect(await controlTops(page)).toEqual(resting);
  await capture(page, info, 'blocked');
  await accessibility(page, info, 'blocked');
  await contrast(page, info, 'blocked');
  await board.press('ArrowRight');
  await board.press('d');
  await counts(page, 2, 2);
  await capture(page, info, 'first-crate-on-goal');
  const rate = viewport.width === 390 ? 4 : 1;
  await measureSokoban(page, info, rate);
  // A second pass of the same walk, to show the first was not a lucky one.
  await measureSokoban(page, info, rate, {
    step: walking(22),
    name: 'responsiveness-pass-2',
  });
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
  // regression: sokoban-solved-way-on-hidden
  // The way on is offered once, filled, and wholly on screen.
  const next = page.getByTestId('content-next-puzzle');
  await expect(next).toBeInViewport({ ratio: 1 });
  await capture(page, info, 'solved');
  // The solved state is scanned as well as the fresh board (after timing).
  await accessibility(page, info, 'solved');
  await contrast(page, info, 'solved');
  // Each way on is pressed for real and asks for its own destination.
  const opened = page.getByTestId('story-way-on-opened');
  await next.click();
  await expect(opened).toHaveText('Lift');
  await page
    .getByRole('button', { name: 'Pack overview', exact: true })
    .click();
  await expect(opened).toHaveText('Pack overview');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await counts(page, 0, 0);
  await expect(page.getByTestId('sokoban-solved')).toHaveCount(0);
  await capture(page, info, 'restarted');
  await accessibility(page, info, 'restarted');
  await contrast(page, info, 'restarted');
  // Pushes and the pointer's Undo, timed from the restarted board.
  await measureSokoban(page, info, rate, {
    step: pushAndUndo,
    name: 'responsiveness-push-undo',
  });
  expect(errors).toEqual([]);
}
