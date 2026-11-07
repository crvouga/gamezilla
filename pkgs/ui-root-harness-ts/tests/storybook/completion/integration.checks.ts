import { expect, type Locator, type Page, test } from '@playwright/test';

async function open(
  page: Page,
  state: string,
  viewport: { width: number; height: number },
  theme: string
) {
  await page.setViewportSize(viewport);
  await page.goto(
    `/iframe.html?id=screens-games-frame--${state}&viewMode=story&globals=theme:${theme}`
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
      'finished-long-record',
      'cancelled',
    ]) {
      test(`storybook integration: ${state} leads with its outcome and next action at ${screen.width}/${theme}`, async ({
        page,
      }) => {
        await open(page, state, screen, theme);
        const headline = page.getByTestId('custom-game-result-headline');
        await expect(headline).toHaveCount(1);
        const actions = page.locator(
          '[data-testid="custom-game-rematch"], [data-testid="custom-game-new"], [data-testid="custom-game-review-start"], [data-testid="custom-game-back"]'
        );
        const first = await box(actions.first());
        const last = await box(actions.last());
        expect(first.y).toBeGreaterThanOrEqual(0);
        expect(last.y + last.height).toBeLessThanOrEqual(screen.height);
        if (screen.width < 1440) {
          const board = await box(page.getByTestId('custom-game-public'));
          expect(last.y + last.height).toBeLessThanOrEqual(board.y);
        } else {
          const record = await box(
            page.locator('[data-component="CustomGameReview"]')
          );
          expect(last.y + last.height).toBeLessThanOrEqual(record.y);
        }
        for (const id of [
          'custom-game-rematch',
          'custom-game-new',
          'custom-game-review-start',
          'custom-game-back',
        ]) {
          expect(await page.getByTestId(id).count()).toBeLessThanOrEqual(1);
        }
        await expect(
          page.getByTestId('custom-game-move-strip-place')
        ).toHaveText(state === 'cancelled' ? 'Cancelled' : 'Finished');
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
for (const sample of [
  { story: 'your-turn', label: 'Live' },
  { story: 'connection-needed', label: 'Offline' },
  { story: 'offline-local', label: 'Playing offline' },
  { story: 'move-waiting', label: 'Waiting for connection' },
  { story: 'stopped', label: 'Stopped' },
  { story: 'reviewing-earlier-move', label: 'Reviewing move 3 of 7' },
  { story: 'earlier-game-record', label: 'Reviewing move 7 of 7' },
])
  for (const width of [390, 1440])
    test(`storybook integration: ${sample.story} record says its actual state at ${width}`, async ({
      page,
    }) => {
      await open(page, sample.story, { width, height: 900 }, 'light');
      const place = page.getByTestId('custom-game-move-strip-place');
      await expect(place).toHaveText(sample.label);
      if (sample.label !== 'Live') {
        const stateRow = place.locator('..');
        await expect(
          stateRow.locator('[data-component="StatusDot"][data-status="online"]')
        ).toHaveCount(0);
      }
      if (sample.story.includes('earlier')) {
        await expect(
          page.getByTestId('custom-game-back-to-live')
        ).toHaveAccessibleName('Back to current game');
        await expect(page.getByTestId('custom-game-review-live')).toBeVisible();
      }
    });

// regression: frame-fixture-inactive-board-prompts
for (const state of [
  'cancelled',
  'connection-needed',
  'move-waiting',
  'stopped',
  'reviewing-earlier-move',
  'earlier-game-record',
  'opponents-turn',
]) {
  test(`storybook integration: ${state} fixture offers no drop instruction`, async ({
    page,
  }) => {
    await open(page, state, { width: 390, height: 844 }, 'light');
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
test('storybook integration: completing then reviewing keeps one outcome and the confirmation acknowledgment', async ({
  page,
}) => {
  await open(page, 'finish-and-review', { width: 390, height: 844 }, 'light');
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
  await expect(page.getByTestId('custom-game-reviewing')).toContainText(
    'Reviewing the starting position'
  );
  await page.getByTestId('custom-game-back-to-live').click();
  await expect(page.getByTestId('custom-game-reviewing')).toHaveCount(0);
  await expect(page.getByTestId('custom-game-move-strip-place')).toHaveText(
    'Finished'
  );
});

// regression: game-record-current-selection-labeled-live
test('storybook integration: literal offline record keeps its current state', async ({
  page,
}) => {
  await open(page, 'connection-needed', { width: 390, height: 844 }, 'light');
  await expect(page.getByTestId('custom-game-move-strip-place')).toHaveText(
    'Offline'
  );
});

// regression: frame-fixture-inactive-board-prompts
test('storybook integration: literal cancelled board offers no drop instruction', async ({
  page,
}) => {
  await open(page, 'cancelled', { width: 390, height: 844 }, 'light');
  await expect(
    page.getByText('Pick a column to drop your disc', { exact: true })
  ).toHaveCount(0);
  await expect(
    page
      .getByTestId('custom-game-board')
      .locator('button:enabled:not([aria-disabled="true"])')
  ).toHaveCount(0);
});
