import { expect, test } from '@playwright/test';
import {
  captureChessState,
  measureChessInput,
  openChessStory,
  squareCenter,
} from './evidence';

test.use({ video: 'on', trace: 'on', hasTouch: true });

const states = [
  'screens-games-chess-board--your-turn',
  'screens-games-chess-board--waiting-for-opponent',
  'screens-games-chess-board--watching',
  'screens-games-chess-board--in-check',
  'screens-games-chess-board--checkmated',
  'screens-games-chess-board--promotion-choice',
  'screens-puzzles-chess-play--solving',
  'screens-puzzles-chess-play--solve-journey',
  'screens-puzzles-chess-play--wrong-move-recovery',
] as const;

for (const width of [390, 768, 1440]) {
  for (const theme of ['light', 'dark']) {
    test.describe(`chess ${width} ${theme}`, () => {
      test.use({ viewport: { width, height: 900 } });

      for (const id of states) {
        test(`storybook integration: ${id} evidence`, async ({
          page,
        }, info) => {
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await openChessStory(page, id, theme);
          await captureChessState(page, info, id);
          expect(errors).toEqual([]);
        });
      }

      test('storybook integration: chess mouse touch keyboard and timing', async ({
        page,
      }, info) => {
        await openChessStory(page, 'product-chessboard--initial', theme);
        await captureChessState(page, info, 'before-input');
        await measureChessInput(page, info);
        await captureChessState(page, info, 'selected-e2');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Enter');
        await expect(
          page.getByRole('button', { name: 'e4, White pawn' })
        ).toBeAttached();
        await captureChessState(page, info, 'keyboard-e4');
        const from = await squareCenter(page, 'e7');
        const to = await squareCenter(page, 'e5');
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 12 });
        await page.mouse.up();
        await expect(
          page.getByRole('button', { name: 'e5, Black pawn' })
        ).toBeAttached();
        await captureChessState(page, info, 'mouse-e5');
        for (const square of ['g1', 'f3']) {
          const point = await squareCenter(page, square);
          await page.touchscreen.tap(point.x, point.y);
        }
        await expect(
          page.getByRole('button', { name: 'f3, White knight' })
        ).toBeAttached();
        await captureChessState(page, info, 'touch-f3');
      });
    });
  }
}
