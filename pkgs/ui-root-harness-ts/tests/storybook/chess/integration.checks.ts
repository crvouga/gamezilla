import { expect, type Page, type TestInfo, test } from '@playwright/test';
import {
  captureAssistiveActivation,
  capturePromotion,
} from './assistive-evidence';
import {
  captureChessState,
  measureChessInput,
  openChessStory,
  squareCenter,
} from './evidence';
import { measureChessFrame } from './frame-performance';

test.use({ video: 'on', trace: 'on', hasTouch: true });

// regression: chess-tablet-recovery-guidance-collapse
test('storybook integration: chess tablet recovery keeps every square anchored', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await openChessStory(
    page,
    'screens-puzzles-chess-play--wrong-move-recovery',
    'light'
  );
  await captureChessState(page, info, 'tablet-recovery');
});

// regression: chess-puzzle-retry-leaves-board-scrolled-away
test('storybook integration: chess puzzle 320x640 Retry brings the whole board back into view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  // The story reaches Retry below the fold, then requires every square
  // unclipped by the scrolling screen after it.
  await openChessStory(
    page,
    'screens-puzzles-chess-play--wrong-move-recovery',
    'light'
  );
  const board = await page
    .locator('[data-component="ChessBoard"]')
    .boundingBox();
  if (!board) throw new Error('Missing board');
  expect(board.y).toBeGreaterThanOrEqual(0);
});

// regression: chess-puzzle-board-below-short-landscape-fold
test('storybook integration: chess puzzle 844x390 shows every square beside its actions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openChessStory(page, 'screens-puzzles-chess-play--solving', 'light');
  const board = await page
    .locator('[data-component="ChessBoard"]')
    .boundingBox();
  if (!board) throw new Error('Missing board');
  for (const square of ['a1', 'h1', 'a8', 'h8']) {
    const cell = await page.locator(`[data-square="${square}"]`).boundingBox();
    if (!cell) throw new Error(`Missing ${square}`);
    expect(cell.width).toBeGreaterThanOrEqual(32);
    expect(cell.y).toBeGreaterThanOrEqual(0);
    expect(cell.y + cell.height).toBeLessThanOrEqual(390);
  }
  const hint = await page.getByRole('button', { name: /^Hint/ }).boundingBox();
  if (!hint) throw new Error('Missing Hint');
  expect(hint.x).toBeGreaterThanOrEqual(board.x + board.width);
  expect(hint.y + hint.height).toBeLessThanOrEqual(390);
});

// regression: chess-puzzle-guidance-below-short-landscape-fold
test('storybook integration: chess puzzle 844x390 opens keyboard help with every square in view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  // The story opens Keyboard controls and asserts every square stays in view.
  await openChessStory(
    page,
    'screens-puzzles-chess-play--keyboard-help',
    'light'
  );
  const summary = await page.getByText('Keyboard controls').boundingBox();
  if (!summary) throw new Error('Missing Keyboard controls');
  expect(summary.y + summary.height).toBeLessThanOrEqual(390);
});

// regression: chess-puzzle-board-below-short-landscape-fold
test('storybook integration: chess puzzle 768x900 keeps Hint and Skip in the first view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await openChessStory(page, 'screens-puzzles-chess-play--solving', 'light');
  for (const name of [/^Hint/, /^Skip puzzle/]) {
    const action = await page.getByRole('button', { name }).boundingBox();
    if (!action) throw new Error(`Missing action ${String(name)}`);
    expect(action.y + action.height).toBeLessThanOrEqual(900);
  }
  const cell = await page.locator('[data-square="a1"]').boundingBox();
  if (!cell) throw new Error('Missing a1');
  expect(cell.width).toBeGreaterThanOrEqual(40);
});

/** Keyboard, mouse drag and touch moves, with the timing samples first. */
async function inputJourney(
  page: Page,
  info: TestInfo,
  theme: string,
  motion: 'reduced' | 'system' = 'reduced'
) {
  await openChessStory(page, 'product-chessboard--initial', theme, motion);
  if (motion === 'reduced')
    await expect(
      page.locator('[data-component="ThemeProvider"]').first()
    ).toHaveAttribute('data-reduced-motion', 'true');
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
}

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
  'screens-games-chess-board--opening',
  'screens-games-chess-board--early-game',
  'screens-games-chess-board--stalemate',
  'screens-games-chess-board--insufficient-material',
  'screens-games-chess-board--timed',
  'screens-games-chess-board--move-waiting',
  'screens-games-chess-board--connection-needed',
  'screens-puzzles-chess-play--hint',
  'screens-puzzles-chess-play--solution-shown',
  'screens-puzzles-chess-play--keyboard-help',
  'product-chessboard--black-orientation',
  'product-chessboard--read-only',
  'product-chessboard--endgame',
] as const;

// Small phone, phone, tablet, desktop and a short landscape phone.
const sizes = [
  { width: 320, height: 640 },
  { width: 390, height: 900 },
  { width: 768, height: 900 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
] as const;

for (const { width, height } of sizes) {
  for (const theme of ['light', 'dark']) {
    test.describe(`chess ${width} ${theme}`, () => {
      test.use({ viewport: { width, height } });

      if (height === 900)
        test('storybook integration: chess full game screen timing', async ({
          page,
        }, info) => {
          await measureChessFrame(page, info, theme);
        });

      test('storybook integration: chess assistive activation evidence', async ({
        page,
      }, info) => {
        await captureAssistiveActivation(page, info, theme);
      });

      test('storybook integration: chess promotion and cancellation evidence', async ({
        page,
      }, info) => {
        await capturePromotion(page, info, theme);
      });

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
        await inputJourney(page, info, theme);
      });
    });
  }
}

// Animated moves: every other capture runs with reduced motion.
for (const theme of ['light', 'dark']) {
  test.describe(`chess 390 ${theme} motion`, () => {
    test.use({
      viewport: { width: 390, height: 900 },
      contextOptions: { reducedMotion: 'no-preference' },
    });
    test('storybook integration: chess input journey with motion', async ({
      page,
    }, info) => {
      await inputJourney(page, info, theme, 'system');
      // The story must render with motion, not the preview's reduced default.
      await expect(
        page.locator('[data-component="ThemeProvider"]').first()
      ).not.toHaveAttribute('data-reduced-motion', 'true');
    });
  });
}
