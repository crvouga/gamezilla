// @io-wall-ok — Playwright owns the browser for these literal board regressions.
import { expect, test } from '@playwright/test';
import { expectQuoridorStoryPasses } from '../quoridor-overhaul/evidence';

// regression: quoridor-pawn-ink-vanishes-in-dark-theme
test('storybook integration: quoridor overhaul regression, every Hill pawn is readable on sand in the dark theme', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // The story's play asserts each pawn's ink is at least 4.5:1 on its square.
  await expectQuoridorStoryPasses(
    page,
    'screens-games-quoridor-hill--opening',
    'dark'
  );
});

// regression: quoridor-tablet-board-undersized
test('storybook integration: quoridor overhaul regression, the tablet board is centred and uses its column', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  // The story's play asserts a centred board at least 440px wide.
  await expectQuoridorStoryPasses(
    page,
    'screens-games-quoridor-classic--opening',
    'light'
  );
});

// regression: quoridor-fixed-stage-clips-wall-commit
test('storybook integration: quoridor overhaul regression, a proposed wall can be placed on the phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // The story's play proposes a wall and presses Place; the phone's fixed
  // game view had clipped Place under its command bar.
  await expectQuoridorStoryPasses(
    page,
    'screens-games-quoridor-classic--precise-coordinates',
    'light'
  );
});

// regression: quoridor-precision-controls-clip-board
test('storybook integration: Quoridor phone keeps the board and coordinate controls visible through a wall placement', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expectQuoridorStoryPasses(
    page,
    'screens-games-quoridor-classic--direct-manipulation',
    'light',
    'system'
  );
  const board = page.getByTestId('custom-game-board');
  await page.getByTestId('custom-game-board-coordinates').click();
  await page.getByRole('button', { name: 'Horizontal wall' }).click();
  const anchor = board.locator('[data-cell="d4"]');
  await anchor.click();
  await expect(anchor).toHaveAttribute('data-preview-edge-top', 'true');
  for (const target of [
    board,
    page.getByRole('button', { name: 'Done' }),
    page.getByTestId('custom-game-board-precise-target'),
    page.getByTestId('custom-game-board-wall-commit'),
    page.getByTestId('custom-game-board-wall-cancel'),
  ])
    await expect(target).toBeInViewport({ ratio: 1 });
  await info.attach('wall-preview', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.getByTestId('custom-game-board-wall-commit').click();
  await expect(anchor).toHaveAttribute('data-edge-top', 'true');
  await info.attach('wall-placed', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
