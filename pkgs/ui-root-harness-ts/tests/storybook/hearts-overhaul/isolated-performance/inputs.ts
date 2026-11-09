// @io-wall-ok — trusted input with rendering settled before the next action.
import { expect, type Locator, type Page } from '@playwright/test';
import { settleHeartsFrames } from '../metrics';
import { pressRefusedCard } from '../refused-input';

export async function exerciseHeartsTrick(page: Page, touch: boolean) {
  const activate = async (card: Locator) => {
    if (touch) await card.tap();
    else await card.click();
    await settleHeartsFrames(page);
  };
  const hand = page.getByRole('toolbar', { name: 'Your hand' });
  const cards = hand.getByRole('button');
  for (const index of [0, 1, 2]) await activate(cards.nth(index));
  await activate(page.getByTestId('custom-game-board-pass'));
  const board = page.getByTestId('custom-game-board');
  await expect(board).toHaveAttribute('data-position', /:play:/);
  const position = await board.getAttribute('data-position');
  await pressRefusedCard(
    page,
    hand.locator('[data-refused="true"]').first(),
    touch
  );
  await settleHeartsFrames(page);
  await expect(board).toHaveAttribute('data-position', position ?? '');
  for (const _turn of [0, 1, 2, 3]) {
    const legal = hand.locator('button[aria-disabled="false"]').first();
    const id = await legal.getAttribute('data-testid');
    await activate(legal);
    await expect(page.getByTestId(id ?? '')).toHaveCount(0);
  }
  await expect(page.getByTestId('custom-game-board-center')).toContainText(
    'took the trick'
  );
}
