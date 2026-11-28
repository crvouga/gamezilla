// @io-wall-ok — hosted native input against the production match board.
import { expect, test } from '@playwright/test';
import {
  markEvidencePhase,
  observeInput,
  openStory,
  recordEvidence,
} from '../word-tiles/evidence';
import { retainEvidence } from '../word-tiles/retained-evidence';

import {
  assertPlacement,
  centerCell,
  point,
  rackTile,
  squareAt,
  viewport,
} from './board-targets';
import { measureGestures, saveGestures } from './gesture-evidence';

test.use({ video: 'on', trace: 'on' });
test.beforeEach(async ({ page }) => observeInput(page));
test.afterEach(async ({ page }, info) => recordEvidence(page, info));

test.describe('desktop', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    contextOptions: { reducedMotion: 'no-preference' },
  });
  test('storybook integration: word-tiles gesture desktop zoom pan drag cancel and fit', async ({
    page,
  }, info) => {
    await openStory(page, 'four-player-match', 'light');
    await measureGestures(page);
    await retainEvidence(info, 'opening-board.png', {
      body: await viewport(page).screenshot(),
      contentType: 'image/png',
    });
    const anchor = await point(centerCell(page));
    const before = await centerCell(page).boundingBox();
    await page.mouse.move(anchor.x, anchor.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    await expect
      .poll(async () => (await centerCell(page).boundingBox())?.width ?? 0)
      .toBeGreaterThan((before?.width ?? 0) * 1.2);
    expect(await squareAt(page, anchor)).toBe('h8');
    const prior = await point(centerCell(page));
    await page.mouse.down();
    await page.mouse.move(anchor.x + 40, anchor.y + 30, { steps: 6 });
    await page.mouse.up();
    expect((await point(centerCell(page))).x - prior.x).toBeGreaterThan(20);
    await expect(
      page.locator('[data-state="tentative"][data-cell]')
    ).toHaveCount(0);
    const src = await point(rackTile(page));
    const dest = await point(centerCell(page));
    await markEvidencePhase(page, 'gesture-drag');
    for (const cancel of [true, false]) {
      await page.mouse.move(src.x, src.y);
      await page.mouse.down();
      await page.mouse.move(dest.x, dest.y, { steps: 12 });
      await expect(centerCell(page)).toHaveAttribute(
        'data-drop-target',
        'true'
      );
      await retainEvidence(
        info,
        cancel ? 'cancel-target.png' : 'drop-target.png',
        { body: await viewport(page).screenshot(), contentType: 'image/png' }
      );
      if (cancel) await page.keyboard.press('Escape');
      await page.mouse.up();
      if (cancel)
        await expect(centerCell(page)).toHaveAttribute('data-state', 'empty');
    }
    await assertPlacement(page);
    await saveGestures(page, info);
    await page.getByRole('button', { name: 'Fit board', exact: true }).click();
    await expect
      .poll(async () => (await centerCell(page).boundingBox())?.width)
      .toBe(before?.width);
  });
});

test('storybook integration: word-tiles gesture assigned blank remains marked after commit', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openStory(page, 'three-player-match', 'light');
  const board = page.getByTestId('game-session-board');
  const blank = centerCell(page);
  for (const [tile, square] of [
    ['11', 'g8'],
    ['98', 'h8'],
    ['82', 'i8'],
  ]) {
    await page.getByTestId(`game-session-board-rack-${tile}`).click();
    await page.getByTestId(`game-session-board-cell-${square}`).click();
    if (tile === '98')
      await page.getByTestId('game-session-board-blank-A').click();
  }
  await expect(blank).toHaveAttribute('data-state', 'tentative');
  await expect(blank.getByText('A', { exact: true })).toHaveCSS(
    'text-decoration-line',
    'underline'
  );
  await page.getByTestId('game-session-board-submit').click();
  await expect(blank).toHaveAttribute('data-state', 'recent');
  await expect(blank).toHaveAccessibleName(
    'A 0, h8, blank played as A, last move'
  );
  await expect(blank).toHaveCSS('animation-name', /word-tile-placed/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(blank).toHaveCSS('animation-name', 'none');
  await expect(blank.getByText('A', { exact: true })).toHaveCSS(
    'text-decoration-line',
    'underline'
  );
  await expect(board.getByText('C', { exact: true })).toHaveCSS(
    'text-decoration-line',
    'none'
  );
  await retainEvidence(info, 'committed-blank.png', {
    body: await viewport(page).screenshot(),
    contentType: 'image/png',
  });
});
