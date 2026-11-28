import { expect, test } from '@playwright/test';
import { capture, openSokoban } from '../sokoban-overhaul/evidence';

const viewport = { width: 1440, height: 844 };
test.use({ viewport, video: { mode: 'on', size: viewport }, trace: 'on' });

// regression: sokoban-maximum-board-pushes-pad-off-screen
test('storybook integration: Sokoban 20x20 board leaves the whole pad on a 1440x844 screen', async ({
  page,
}, info) => {
  for (const story of [
    'puzzle--maximum-board',
    'puzzle--dense-maximum-board',
  ]) {
    await openSokoban(page, story);
    const board = page.getByTestId('sokoban-board');
    await expect(board.getByRole('img')).toHaveCount(400);
    await expect(board).toBeInViewport({ ratio: 1 });
    for (const heading of ['up', 'left', 'down', 'right']) {
      const button = page.getByTestId(`sokoban-move-${heading}`);
      await expect(button).toBeInViewport({ ratio: 1 });
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await capture(page, info, `${story}-1440x844`);
  }
});
