// @io-wall-ok — Chromium dispatches the two contacts of a native pinch.
import { expect, test } from '@playwright/test';
import {
  markEvidencePhase,
  observeInput,
  openStory,
  recordEvidence,
} from '../../word-tiles/evidence';
import { retainEvidence } from '../../word-tiles/retained-evidence';
import {
  assertPlacement,
  centerCell,
  point,
  rackTile,
  squareAt,
  viewport,
} from '../board-targets';
import { measureGestures, saveGestures } from '../gesture-evidence';
import { observeTouches, saveTouches } from './touch-evidence';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  contextOptions: { reducedMotion: 'reduce' },
  video: 'on',
  trace: 'on',
});
test.beforeEach(async ({ page }) => {
  await observeInput(page);
  await observeTouches(page);
});
test.afterEach(async ({ page }, info) => {
  await saveTouches(page, info);
  await recordEvidence(page, info);
});

// regression: word-tiles-pinch-midpoint-snaps
// regression: word-tiles-phone-fit-after-drop
test('storybook integration: word-tiles gesture phone pinch pan interrupted pickup and drop', async ({
  page,
}, info) => {
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
    .getByRole('button', {
      name: 'Board tools: zoom and find a square',
      exact: true,
    })
    .tap();
  const tools = page.getByRole('dialog', { name: 'Board tools' });
  await expect(tools).toBeVisible();
  await tools.getByRole('button', { name: 'Fit board', exact: true }).tap();
  await expect(tools).toBeHidden();
  await expect(viewport(page)).toHaveAttribute('data-enlarged', 'false');
  for (const square of ['a1', 'o15']) {
    await expect(
      page.getByTestId(`custom-game-board-cell-${square}`)
    ).toBeInViewport({ ratio: 1 });
  }
  await assertPlacement(page);
  await page.screenshot({ path: info.outputPath('fitted-after-drop.png') });
});
