import { expect, type Locator, type Page, test } from '@playwright/test';
import { expectFinalBoardReachable } from './board-reachability';

/** `story` is `<place>--<state>` of the custom game's stories (`result--you-win`, `stage--your-turn`). */
async function open(
  page: Page,
  story: string,
  viewport: { width: number; height: number },
  theme: string
) {
  await page.setViewportSize(viewport);
  await page.goto(
    `/iframe.html?id=screens-custom-games-${story}&viewMode=story&globals=theme:${theme}`
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

/** The control is what a tap or click at its centre reaches: nothing lies over it. */
async function expectOnTop(control: Locator) {
  expect(
    await control.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      const hit = document.elementFromPoint(x + width / 2, y + height / 2);
      return hit !== null && element.contains(hit);
    })
  ).toBe(true);
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
        const dialog = page.getByRole('dialog', { name: 'Game over' });
        await expect(
          dialog.getByTestId('custom-game-result-headline')
        ).toBeInViewport({ ratio: 1 });
        const board = page.getByTestId('custom-game-board');
        const before = await box(board);
        for (const action of await actions.all()) {
          await expect(action).toBeInViewport({ ratio: 1 });
          await expectOnTop(action);
        }
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
        if (state === 'you-placed-second') {
          await expect(
            dialog.getByText(/jordan_plays 26, You 19/)
          ).toBeVisible();
        }
        await expect(page.getByTestId('custom-game-history-stats')).toHaveCount(
          1
        );
        await dialog.getByTestId('game-result-close').click();
        await expect(dialog).toHaveCount(0);
        expect(await box(board)).toEqual(before);
        for (const action of await actions.all()) {
          await expect(action).toBeInViewport({ ratio: 1 });
          expect((await box(action)).y).toBeGreaterThanOrEqual(
            before.y + before.height
          );
          await expectOnTop(action);
        }
      });
    }
}

// regression: stage-result-card-covers-last-row
// A caption of two lines grew the phone's outcome card up over the final
// board's last row, winning disc included.
test('storybook integration: closing the literal two-line outcome reveals the final board at 390', async ({
  page,
}) => {
  await open(
    page,
    'result--you-placed-second',
    { width: 390, height: 844 },
    'light'
  );
  await expect(page.getByTestId('custom-game-outcome')).toContainText(
    'Host starts the rematch.'
  );
  const board = page.getByTestId('custom-game-board');
  const before = await box(board);
  await page.getByTestId('game-result-close').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await box(board)).toEqual(before);
  const cells = board.locator('[data-cell]');
  await expect(cells).toHaveCount(42);
  for (const cell of await cells.all())
    await expect(cell).toBeInViewport({ ratio: 1 });
});

// regression: game-record-current-selection-labeled-live
// A finished or offline game's record still said "Live". No place carries a
// "Live" label any more: the play place is live by construction, and what is
// not ordinary says so in its own words.
for (const sample of [
  { story: 'stage--your-turn', says: null },
  { story: 'stage--connection-needed', says: 'Moves need a connection' },
  { story: 'stage--offline-local', says: 'Your local game can continue' },
  { story: 'stage--move-waiting', says: 'when the connection returns' },
  { story: 'stage--stopped', says: 'Game stopped.' },
  { story: 'stage-moves--earlier-move', says: 'Move 3 of 8, Red circle' },
  { story: 'stage-moves--earlier-game', says: 'An earlier game, after move 3' },
  { story: 'result--you-win', says: 'You won' },
])
  for (const width of [390, 1440])
    test(`storybook integration: ${sample.story} says its actual state at ${width}`, async ({
      page,
    }) => {
      await open(page, sample.story, { width, height: 900 }, 'light');
      const content = page.getByTestId('custom-game-content');
      await expect(content.getByText('Live', { exact: true })).toHaveCount(0);
      if (sample.says !== null)
        await expect(
          page.getByText(sample.says, { exact: false }).first()
        ).toBeVisible();
      if (sample.story.startsWith('stage-moves--')) {
        await expect(
          page.getByTestId('custom-game-back-to-live')
        ).toBeVisible();
        await expect(page.getByTestId('custom-game-review-live')).toBeVisible();
      }
    });

// regression: frame-fixture-inactive-board-prompts
for (const story of [
  'result--cancelled',
  'stage--connection-needed',
  'stage--move-waiting',
  'stage--stopped',
  'stage-moves--earlier-move',
  'stage-moves--earlier-game',
  'stage--opponents-turn',
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
// regression: custom-game-result-covers-resign-done
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
  await done.click();
  await expect(page.getByTestId('custom-game-result-headline')).toHaveCount(1);
  await expect(page.getByTestId('custom-game-rematch')).toHaveCount(1);
  await expect(page.getByTestId('custom-game-result-headline')).toContainText(
    'You lost'
  );
  // How it ended is the result card's caption, under its headline.
  await expect(page.getByTestId('custom-game-outcome')).toContainText(
    'You resigned.'
  );
  await page.getByTestId('game-result-close').click();
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
    'stage--connection-needed',
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
// regression: wide-connect-four-result-overlaps-commands
test('storybook integration: literal drawn geometry has no winning line', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 844 });
  await page.goto(
    '/iframe.html?id=screens-custom-games-stage-board-priority--drawn&viewMode=story&globals=theme:light'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await expect(page.getByTestId('custom-game-result-headline')).toContainText(
    'The game was drawn'
  );
  const board = page.getByTestId('custom-game-board');
  await expect(board).toHaveAttribute('data-won', 'false');
  await expect(board.locator('[data-winning="true"]')).toHaveCount(0);
  await page.getByTestId('game-result-close').click();
  const final = await box(board);
  const rematch = await box(page.getByTestId('custom-game-rematch'));
  expect(rematch.y).toBeGreaterThanOrEqual(final.y + final.height);
});

/** The board's width in `story` at 1440 × 844. */
async function boardWidth(page: Page, story: string, theme: string) {
  await page.goto(
    `/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
  return (await box(page.getByTestId('custom-game-board'))).width;
}

// The reported 1440 × 844 captures ended before the last row. The stage now
// holds the whole final board in the first view, at the size it was played
// on, beside the outcome; prove every final cell shows and stays shown as
// the keyboard scrolls the screen, which a first-viewport PNG cannot do.
for (const sample of [
  {
    story: 'screens-custom-games-result--you-win',
    played: 'screens-custom-games-stage--your-turn',
  },
  {
    story: 'screens-custom-games-stage-board-priority--win',
    played: 'screens-custom-games-stage-board-priority--two-players',
  },
  {
    story: 'screens-custom-games-stage-board-priority--drawn',
    played: 'screens-custom-games-stage-board-priority--two-players',
  },
]) {
  const { story } = sample;
  for (const theme of ['light', 'dark']) {
    test(`storybook integration: ${story} final board is keyboard reachable at 1440x844/${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width: 1440, height: 844 });
      const played = await boardWidth(page, sample.played, theme);
      // The finished board keeps the size it was played at: never shrunk.
      expect(await boardWidth(page, story, theme)).toBe(played);
      const headline = page.getByTestId('custom-game-result-headline');
      await expect(headline).toHaveCount(1);
      await expect(headline).toBeInViewport({ ratio: 1 });
      const close = page.getByTestId('game-result-close');
      await close.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const actions = page.locator(
        '[data-testid="custom-game-rematch"], [data-testid="custom-game-new"], [data-testid="custom-game-review-start"]'
      );
      expect(await actions.count()).toBeGreaterThan(0);
      const board = page.getByTestId('custom-game-board');
      for (const action of await actions.all()) {
        await expect(action).toBeInViewport({ ratio: 1 });
        const final = await box(board);
        expect((await box(action)).y).toBeGreaterThanOrEqual(
          final.y + final.height
        );
      }
      await expect(board.locator('[data-winning="true"]')).toHaveCount(
        story.endsWith('--drawn') ? 0 : 4
      );
      await expectFinalBoardReachable(page, info);
    });
  }
}
