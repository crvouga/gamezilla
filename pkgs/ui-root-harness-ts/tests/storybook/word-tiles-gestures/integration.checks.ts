// @io-wall-ok — hosted native input against the production match board.
import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  markEvidencePhase,
  observeInput,
  openStory,
  recordEvidence,
} from '../word-tiles/evidence';
import { retainEvidence } from '../word-tiles/retained-evidence';

import { measureGestures, saveGestures } from './gesture-evidence';

test.use({ video: 'on', trace: 'on' });
test.beforeEach(async ({ page }) => observeInput(page));
test.afterEach(async ({ page }, info) => recordEvidence(page, info));

async function point(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('Missing board target');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
const centerCell = (page: Page) =>
  page.getByTestId('custom-game-board-cell-h8');
const rackTile = (page: Page) => page.getByTestId('custom-game-board-rack-11');
const viewport = (page: Page) =>
  page.getByRole('region', { name: 'Scrollable word board' });

async function squareAt(page: Page, p: { x: number; y: number }) {
  return page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest('[data-cell]')
        ?.getAttribute('data-cell'),
    p
  );
}
async function assertPlacement(page: Page) {
  await expect(centerCell(page)).toHaveAccessibleName(
    'C 3, h8, your tentative tile'
  );
  await expect(rackTile(page)).toHaveAttribute('data-placed', 'true');
  await expect(page.locator('[data-state="committed"][data-cell]')).toHaveCount(
    0
  );
}
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

// regression: word-tiles-pinch-midpoint-snaps
test('storybook integration: word-tiles gesture phone pinch pan interrupted pickup and drop', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 2,
  });
  await openStory(page, 'four-player-match', 'light');
  await measureGestures(page);
  await retainEvidence(info, 'opening-board.png', {
    body: await viewport(page).screenshot(),
    contentType: 'image/png',
  });
  type Finger = { x: number; y: number; id: number };
  const touch = (
    type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
    ...touchPoints: Finger[]
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const anchor = await point(centerCell(page));
  const finger = (id: number, dx: number, dy = 0) => ({
    id,
    x: anchor.x + dx,
    y: anchor.y + dy,
  });
  const first = await centerCell(page).boundingBox();
  await touch('touchStart', finger(1, -30), finger(2, 30));
  await touch('touchMove', finger(1, -48), finger(2, 48));
  await touch('touchEnd');
  await expect
    .poll(async () => (await centerCell(page).boundingBox())?.width ?? 0)
    .toBeGreaterThan((first?.width ?? 0) * 1.2);
  expect(await squareAt(page, anchor)).toBe('h8');
  const prior = await point(centerCell(page));
  await touch('touchStart', finger(1, 0));
  await touch('touchMove', finger(1, 30, 20));
  await touch('touchEnd');
  expect((await point(centerCell(page))).x - prior.x).toBeGreaterThan(15);
  const src = { ...(await point(rackTile(page))), id: 1 };
  const dest = { ...(await point(centerCell(page))), id: 1 };
  await markEvidencePhase(page, 'gesture-drag');
  for (const finish of ['second finger', 'cancel', 'place']) {
    await touch('touchStart', src);
    await touch('touchMove', {
      x: (src.x + dest.x) / 2,
      y: (src.y + dest.y) / 2,
      id: 1,
    });
    await touch('touchMove', dest);
    await expect(centerCell(page)).toHaveAttribute('data-drop-target', 'true');
    if (finish === 'second finger')
      await touch('touchStart', dest, finger(2, 50));
    await touch(finish === 'cancel' ? 'touchCancel' : 'touchEnd');
    if (finish !== 'place')
      await expect(centerCell(page)).toHaveAttribute('data-state', 'empty');
  }
  await assertPlacement(page);
  await saveGestures(page, info);
  await expect(centerCell(page).locator('span').first()).toHaveCSS(
    'animation-name',
    'none'
  );
  await retainEvidence(info, 'placed.png', {
    body: await viewport(page).screenshot(),
    contentType: 'image/png',
  });
  await page
    .getByRole('button', { name: 'Board tools: zoom and find a square' })
    .tap();
  await page.getByRole('button', { name: 'Fit board', exact: true }).tap();
  await expect(viewport(page)).toHaveAttribute('data-enlarged', 'false');
});

test('storybook integration: word-tiles gesture assigned blank remains marked after commit', async ({
  page,
}, info) => {
  await openStory(page, 'three-player-match', 'light');
  const board = page.getByTestId('custom-game-board');
  const blank = centerCell(page);
  for (const [tile, square] of [
    ['11', 'g8'],
    ['98', 'h8'],
    ['82', 'i8'],
  ]) {
    await page.getByTestId(`custom-game-board-rack-${tile}`).click();
    await page.getByTestId(`custom-game-board-cell-${square}`).click();
    if (tile === '98')
      await page.getByTestId('custom-game-board-blank-A').click();
  }
  await expect(blank).toHaveAttribute('data-state', 'tentative');
  await expect(blank.getByText('A', { exact: true })).toHaveCSS(
    'text-decoration-line',
    'underline'
  );
  await page.getByTestId('custom-game-board-submit').click();
  await expect(blank).toHaveAttribute('data-state', 'committed');
  await expect(blank).toHaveAccessibleName('A 0, h8, blank played as A');
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
