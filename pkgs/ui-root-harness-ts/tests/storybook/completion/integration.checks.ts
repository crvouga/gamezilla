import { expect, type Locator, type Page, test } from '@playwright/test';
import { expectFinalBoardReachable } from './board-reachability';

/** `story` is `<place>--<state>` of the custom game's stories (`result--you-win`). */
async function open(
  page: Page,
  story: string,
  viewport: { width: number; height: number },
  theme: string
) {
  await page.setViewportSize(viewport);
  await page.goto(
    `/iframe.html?id=screens-games-custom-${story}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  if (value === null) throw new Error('Required game surface is missing');
  return value;
}

// regression: completed-game-next-actions-below-board
for (const screen of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  for (const theme of ['light', 'dark'])
    for (const state of [
      'you-win',
      'draw',
      'you-placed-second',
      'watcher-sees-result',
      'cancelled',
    ]) {
      test(`storybook integration: ${state} leads with its outcome and next action at ${screen.width}/${theme}`, async ({
        page,
      }) => {
        await open(page, `result--${state}`, screen, theme);
        const headline = page.getByTestId('custom-game-result-headline');
        await expect(headline).toHaveCount(1);
        const actions = page.locator(
          '[data-testid="custom-game-rematch"], [data-testid="custom-game-new"], [data-testid="custom-game-review-start"], [data-testid="custom-game-back"]'
        );
        const first = await box(actions.first());
        const last = await box(actions.last());
        expect(first.y).toBeGreaterThanOrEqual(0);
        expect(last.y + last.height).toBeLessThanOrEqual(screen.height);
        // The outcome and what comes next lead the final board on every size.
        const board = await box(page.getByTestId('custom-game-public'));
        expect(last.y + last.height).toBeLessThanOrEqual(board.y);
        for (const id of [
          'custom-game-rematch',
          'custom-game-new',
          'custom-game-review-start',
          'custom-game-back',
        ]) {
          expect(await page.getByTestId(id).count()).toBeLessThanOrEqual(1);
        }
        // At most one filled command: the rematch, or the way back.
        expect(
          await page.locator('button[data-variant="solid"]').count()
        ).toBeLessThanOrEqual(1);
        if (state !== 'cancelled') {
          await expect(
            page.getByRole('list', { name: 'Standings' }).getByRole('listitem')
          ).toHaveCount(2);
        }
        await expect(page.getByTestId('custom-game-history-stats')).toHaveCount(
          1
        );
      });
    }
}

// regression: game-record-current-selection-labeled-live
// A finished or offline game's record still said "Live". No place carries a
// "Live" label any more: the play place is live by construction, and what is
// not ordinary says so in its own words.
for (const sample of [
  { story: 'play--your-turn', says: null },
  { story: 'play--connection-needed', says: 'Connection needed' },
  { story: 'play--offline-local', says: 'Your local game can continue' },
  { story: 'play--move-waiting', says: 'when the connection returns' },
  { story: 'play--stopped', says: 'The game stopped' },
  { story: 'moves--earlier-move', says: 'After move 3 of 8' },
  { story: 'moves--earlier-game', says: 'An earlier game, after move 3' },
  { story: 'result--you-win', says: 'You win' },
])
  for (const width of [390, 1440])
    test(`storybook integration: ${sample.story} says its actual state at ${width}`, async ({
      page,
    }) => {
      await open(page, sample.story, { width, height: 900 }, 'light');
      const content = page.getByTestId('custom-game-content');
      await expect(content.getByText('Live', { exact: true })).toHaveCount(0);
      if (sample.says !== null)
        await expect(content).toContainText(sample.says);
      if (sample.story.startsWith('moves--')) {
        await expect(
          page.getByTestId('custom-game-back-to-live')
        ).toBeVisible();
        await expect(page.getByTestId('custom-game-review-live')).toBeVisible();
      }
    });

// regression: frame-fixture-inactive-board-prompts
for (const story of [
  'result--cancelled',
  'play--connection-needed',
  'play--move-waiting',
  'play--stopped',
  'moves--earlier-move',
  'moves--earlier-game',
  'play--opponents-turn',
]) {
  test(`storybook integration: ${story} fixture offers no drop instruction`, async ({
    page,
  }) => {
    await open(page, story, { width: 390, height: 844 }, 'light');
    await expect(
      page.getByText('Pick a column to drop your disc', { exact: true })
    ).toHaveCount(0);
    await expect(
      page
        .getByTestId('custom-game-board')
        .locator('button:enabled:not([aria-disabled="true"])')
    ).toHaveCount(0);
  });
}

// regression: completed-game-next-actions-below-board
// Exercise the frame's actual reactive transition, not only static end-state fixtures.
test('storybook integration: resigning from the game menu keeps one outcome and the confirmation acknowledgment, then the moves and back', async ({
  page,
}) => {
  await open(
    page,
    'result--finish-from-game-menu',
    { width: 390, height: 844 },
    'light'
  );
  await page.getByTestId('custom-game-resign').click();
  await page.getByTestId('custom-game-resign-confirm').click();
  const done = page.getByTestId('custom-game-resign-done');
  await expect(done).toBeVisible();
  await expect(page.getByTestId('custom-game-result-headline')).toHaveCount(1);
  await expect(page.getByTestId('custom-game-rematch')).toHaveCount(1);
  await expect(page.getByTestId('custom-game-result-headline')).toContainText(
    'You came 2nd'
  );
  await expect(page.getByTestId('custom-game-result-headline')).toContainText(
    'You resigned.'
  );
  await done.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByTestId('custom-game-review-start').click();
  await expect(page.getByTestId('custom-game-reviewing')).toBeVisible();
  await expect(page.getByTestId('custom-game-rematch')).toHaveCount(0);
  await page.getByTestId('custom-game-back-to-live').click();
  await expect(page.getByTestId('custom-game-reviewing')).toHaveCount(0);
  await expect(page.getByTestId('custom-game-result-headline')).toHaveCount(1);
});

// regression: game-record-current-selection-labeled-live
test('storybook integration: literal offline play says the connection is needed', async ({
  page,
}) => {
  await open(
    page,
    'play--connection-needed',
    { width: 390, height: 844 },
    'light'
  );
  await expect(page.getByTestId('custom-game-connection-needed')).toBeVisible();
  await expect(
    page.getByTestId('custom-game-content').getByText('Live', { exact: true })
  ).toHaveCount(0);
});

// regression: frame-fixture-inactive-board-prompts
test('storybook integration: literal cancelled board offers no drop instruction', async ({
  page,
}) => {
  await open(page, 'result--cancelled', { width: 390, height: 844 }, 'light');
  await expect(
    page.getByText('Pick a column to drop your disc', { exact: true })
  ).toHaveCount(0);
  await expect(
    page
      .getByTestId('custom-game-board')
      .locator('button:enabled:not([aria-disabled="true"])')
  ).toHaveCount(0);
});

// regression: shared-drawn-geometry-winning-position
test('storybook integration: literal drawn geometry has no winning line', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 844 });
  await page.goto(
    '/iframe.html?id=screens-games-frame-geometry--drawn&viewMode=story&globals=theme:light'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await expect(page.getByTestId('custom-game-result-headline')).toContainText(
    'Draw'
  );
  const board = page.getByTestId('custom-game-board');
  await expect(board).toHaveAttribute('data-won', 'false');
  await expect(board.locator('[data-winning="true"]')).toHaveCount(0);
});

// The reported 1440 × 844 captures ended before the last row. Prove that
// keyboard scrolling exposes it; a matching first-viewport PNG cannot do that.
for (const story of [
  'screens-games-custom-result--you-win',
  'screens-games-frame-geometry--win',
  'screens-games-frame-geometry--drawn',
]) {
  for (const theme of ['light', 'dark']) {
    test(`storybook integration: ${story} final board is keyboard reachable at 1440x844/${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width: 1440, height: 844 });
      await page.goto(
        `/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      await page.evaluate(() => document.fonts.ready);
      const headline = page.getByTestId('custom-game-result-headline');
      await expect(headline).toHaveCount(1);
      await expect(headline).toBeInViewport({ ratio: 1 });
      const actions = page.locator(
        '[data-testid="custom-game-rematch"], [data-testid="custom-game-new"], [data-testid="custom-game-review-start"]'
      );
      expect(await actions.count()).toBeGreaterThan(0);
      const board = page.getByTestId('custom-game-board');
      for (const action of await actions.all()) {
        await expect(action).toBeInViewport({ ratio: 1 });
        const actionBox = await box(action);
        expect(actionBox.y + actionBox.height).toBeLessThan(
          (await box(board)).y
        );
      }
      await expect(board.locator('[data-winning="true"]')).toHaveCount(
        story.endsWith('--drawn') ? 0 : 4
      );
      await expectFinalBoardReachable(page, info);
    });
  }
}
