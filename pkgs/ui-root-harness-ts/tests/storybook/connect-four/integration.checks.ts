import { expect, test } from '@playwright/test';
import { openBoard, touchSpectatorColumn } from './capture';
import { boardContext } from './matrix';

test.use(boardContext(390));

// regression: connect-four-evidence-waits-for-spectator-enable
test('storybook integration: connect-four spectator native touch remains inert', async ({
  page,
}) => {
  await openBoard(page, 'watching', 'light');
  const board = page.getByTestId('custom-game-board');
  const before = await board.getAttribute('data-cells');
  await touchSpectatorColumn(page);
  await expect(board).toHaveAttribute('data-cells', before ?? '');
});
