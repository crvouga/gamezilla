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
    await openSokoban(page, story, 'light');
    await expect(
      page.getByTestId('sokoban-board').getByRole('img')
    ).toHaveCount(400);
    for (const heading of ['up', 'left', 'down', 'right'])
      await expect(page.getByTestId(`sokoban-move-${heading}`)).toBeInViewport({
        ratio: 1,
      });
    await capture(page, info, `${story}-1440x844`);
  }
});
