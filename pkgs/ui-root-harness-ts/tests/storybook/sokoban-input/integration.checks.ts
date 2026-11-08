import { expect, test } from '@playwright/test';
import {
  accessibility,
  capture,
  counts,
  openSokoban,
} from '../sokoban-overhaul/evidence';
import { builderGeometry } from './builder-geometry';

test.use({ hasTouch: true, video: 'on', trace: 'on' });

test('storybook integration: Sokoban builder controls remain reachable at the reported viewport', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1200, height: 884 });
  await openSokoban(page, 'editor--two-crates', 'dark');
  await capture(page, info, 'builder-top');
  const geometry = await builderGeometry(page, info);
  expect(
    geometry.controls.filter(
      (control) => control.inScroller && !control.topmost
    ),
    JSON.stringify(geometry)
  ).toEqual([]);
  await capture(page, info, 'builder-bottom');
  for (const name of ['Undo', 'Redo']) {
    const control = page.getByRole('button', { name, exact: true });
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport();
  }
  const preview = page.getByTestId('content-preview');
  await preview.click({ trial: true });
  await capture(page, info, 'builder-preview-reachable');
});

test('storybook integration: Sokoban editor corrects a missing worker', async ({
  page,
}, info) => {
  await openSokoban(page, 'editor--edit-and-correct', 'light');
  await expect(page.getByTestId('sokoban-ready')).toBeVisible();
  await expect(page.getByTestId('sokoban-square-B3')).toHaveAttribute(
    'data-identity',
    'three'
  );
  await capture(page, info, 'editor-corrected');
  await accessibility(page, info);
});

test('storybook integration: Sokoban touch swipe and cancellation preserve one-step steering', async ({
  page,
}, info) => {
  await openSokoban(page, 'puzzle--fresh', 'light');
  const box = await page.getByTestId('sokoban-board').boundingBox();
  if (!box) throw new Error('Sokoban board is missing');
  const touch = await page.context().newCDPSession(page);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  try {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point],
    });
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...point, x: point.x + 60 }],
    });
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await counts(page, 1, 1);
    await capture(page, info, 'touch-push');
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point],
    });
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    });
    await counts(page, 1, 1);
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point],
    });
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...point, x: point.x - 60 }],
    });
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await counts(page, 2, 1);
    await capture(page, info, 'after-touch-cancel');
  } finally {
    await touch.detach();
  }
});

// regression: sokoban-board-loses-outside-pointer-release
test('storybook integration: Sokoban mouse taps and captured outside release', async ({
  page,
}, info) => {
  await openSokoban(page, 'puzzle--fresh', 'light');
  const board = page.getByTestId('sokoban-board');
  await page.getByTestId('sokoban-board-tile-23').click();
  await counts(page, 1, 1);
  const box = await board.boundingBox();
  if (!box) throw new Error('Sokoban board is missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 48, box.y + box.height / 2);
  await page.mouse.up();
  await counts(page, 2, 2);
  await capture(page, info, 'mouse-push');
  await page.mouse.move(box.x + 48, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(0, box.y + box.height / 2);
  await page.mouse.up();
  await counts(page, 3, 2);
  await capture(page, info, 'outside-release');
});

// regression: sokoban-wide-touch-screen-hides-steering
test('storybook integration: Sokoban wide touch pad keeps full targets and sends one move per tap', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSokoban(page, 'puzzle--fresh', 'dark');
  const right = page.getByRole('button', { name: 'Move right' });
  const box = await right.boundingBox();
  if (!box) throw new Error('Movement control is missing');
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await right.tap();
  await counts(page, 1, 1);
  await right.tap();
  await counts(page, 2, 2);
  await capture(page, info, 'wide-touch');
});

// regression: sokoban-static-preview-captures-navigation
test('storybook integration: Sokoban static preview preserves native touch scrolling and tab order', async ({
  page,
}, info) => {
  await openSokoban(page, 'preview--default', 'light');
  const board = page.locator('[data-component="TileBoard"]');
  await expect(board).toHaveAttribute('tabindex', '-1');
  await expect(board).toHaveAttribute('data-interactive', 'false');
  await expect(board).toHaveCSS('touch-action', 'auto');
  await page.keyboard.press('Tab');
  await expect(board).not.toBeFocused();
  await capture(page, info, 'static-preview');
});

// regression: sokoban-save-queue-silently-drops-fifth-direction
test('storybook integration: Sokoban queued input limit is explicit', async ({
  page,
}, info) => {
  await openSokoban(page, 'puzzle--disabled', 'light');
  const board = page.getByTestId('sokoban-board');
  for (const key of [
    'ArrowRight',
    'ArrowRight',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowRight',
  ])
    await board.press(key);
  await counts(page, 0, 0);
  await expect(page.getByTestId('sokoban-saving')).toHaveText(
    'Direction not added. Four directions are already waiting.'
  );
  await capture(page, info, 'queue-full');
});
