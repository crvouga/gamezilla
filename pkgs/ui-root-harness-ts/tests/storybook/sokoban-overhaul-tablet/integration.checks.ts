import { expect, test } from '@playwright/test';
import { openSokoban } from '../sokoban-overhaul/evidence';
import { solveAndRecover } from '../sokoban-overhaul/solve-and-recover';

const viewport = { width: 768, height: 1024 };
test.use({ viewport, video: { mode: 'on', size: viewport }, trace: 'on' });

test('storybook integration: Sokoban overhaul solve and recover 768/light', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport, 'light');
});

test('storybook integration: Sokoban overhaul solve and recover 768/dark', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport, 'dark');
});

// regression: sokoban-tablet-board-leaves-empty-strip
test('storybook integration: Sokoban tablet board is centred and the pad meets the column edge', async ({
  page,
}) => {
  await openSokoban(page, 'puzzle--fresh', 'light');
  const box = async (testId: string) => {
    const found = await page.getByTestId(testId).boundingBox();
    if (!found) throw new Error(`${testId} is missing`);
    return found;
  };
  const panel = await box('puzzle-attempt-panel');
  const board = await box('sokoban-board');
  const pad = await box('sokoban-move');
  const before = board.x - panel.x;
  const after = panel.x + panel.width - (board.x + board.width);
  expect(Math.abs(before - after)).toBeLessThanOrEqual(2);
  expect(
    Math.abs(panel.x + panel.width - (pad.x + pad.width))
  ).toBeLessThanOrEqual(2);
});
