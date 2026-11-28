import { expect, type Locator, test } from '@playwright/test';
import sharp from 'sharp';
import { verifyStoryScenario } from '../verify-story-scenario';

// regression: hearts-trick-card-double-pip
test('screens-games-hearts-board--your-turn-to-play regression hearts-trick-card-double-pip', async ({
  page,
}) => {
  await verifyStoryScenario(
    page,
    'screens-games-hearts-board--your-turn-to-play',
    { width: 1280, height: 800, globals: {}, suffix: '' }
  );
});

// regression: hearts-unavailable-cards-louder-than-legal
test('screens-games-hearts-board--your-turn-to-play regression hearts-unavailable-cards-louder-than-legal', async ({
  page,
}) => {
  await verifyStoryScenario(
    page,
    'screens-games-hearts-board--your-turn-to-play',
    { width: 390, height: 844, globals: {}, suffix: '' }
  );
});

// regression: space-join-badge-above-title
test('screens-space-join--live regression space-join-badge-above-title', async ({
  page,
}) => {
  await verifyStoryScenario(page, 'screens-space-join--live', {
    width: 390,
    height: 844,
    globals: {},
    suffix: '',
  });
});

// regression: space-recovery-off-center
test('screens-space-ended--long-content regression space-recovery-off-center', async ({
  page,
}) => {
  await verifyStoryScenario(page, 'screens-space-ended--long-content', {
    width: 1280,
    height: 800,
    globals: {},
    suffix: '',
  });
});

// regression: space-share-toast-covers-close
test('screens-spaces-share--added regression space-share-toast-covers-close', async ({
  page,
}, info) => {
  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    await verifyStoryScenario(page, 'screens-spaces-share--added', {
      width,
      height,
      globals: {},
      suffix: '',
    });
    const dialog = page.getByRole('dialog', { name: 'People in this space' });
    const alert = page.getByRole('region', { name: 'Alerts' });
    await expect(alert.getByRole('status')).toHaveText('morgan added');
    await expect(alert).toBeInViewport({ ratio: 1 });
    await dialog.getByRole('button', { name: 'Close', exact: true }).click({
      trial: true,
    });
    await page.screenshot({
      animations: 'disabled',
      path: info.outputPath(`sharing-alert-${width}x${height}.png`),
    });
    await alert.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(alert).toHaveCount(0);
    await expect(dialog).toBeVisible();
  }
});

// regression: word-tiles-enlarged-edge-slivers
test('screens-games-word-tiles-board--four-player-match regression word-tiles-enlarged-edge-slivers', async ({
  page,
}) => {
  await verifyStoryScenario(
    page,
    'screens-games-word-tiles-board--four-player-match',
    { width: 390, height: 844, globals: {}, suffix: '' }
  );
});

// regression: word-tiles-puzzle-board-offset
test('screens-games-word-tiles-puzzle--reach-target regression word-tiles-puzzle-board-offset', async ({
  page,
}) => {
  await verifyStoryScenario(
    page,
    'screens-games-word-tiles-puzzle--reach-target',
    { width: 1280, height: 800, globals: {}, suffix: '' }
  );
});

// regression: chess-early-game-side-marks
test('screens-games-chess-board--early-game regression chess-early-game-side-marks', async ({
  page,
}) => {
  await verifyStoryScenario(page, 'screens-games-chess-board--early-game', {
    width: 390,
    height: 844,
    globals: {},
    suffix: '',
  });
});

// regression: quoridor-hill-camera-viewport
test('screens-games-quoridor-hill--four-player-round regression quoridor-hill-camera-viewport', async ({
  page,
}, info) => {
  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    await verifyStoryScenario(
      page,
      'screens-games-quoridor-hill--four-player-round',
      { width, height, globals: {}, suffix: '' }
    );
    await page.screenshot({ path: info.outputPath(`hill-round-${width}.png`) });
  }
});

// A page region and the layout boxes enclosing it all expose the viewport canvas.
async function expectCanvasBehind(region: Locator): Promise<void> {
  const paint = await region.evaluate((element) => {
    const painted: string[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      if (node.matches('.themeHost')) break;
      const style = getComputedStyle(node);
      if (
        style.backgroundImage !== 'none' ||
        style.backgroundColor !== 'rgba(0, 0, 0, 0)'
      ) {
        painted.push(node.getAttribute('data-component') ?? node.tagName);
      }
    }
    return painted;
  });
  expect(paint).toEqual([]);
}

// regression: space-canvas-restarts-in-content
test('screens-space-home--host-choosing regression space-canvas-restarts-in-content', async ({
  page,
}, info) => {
  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    await verifyStoryScenario(page, 'screens-space-home--host-choosing', {
      width,
      height,
      globals: {},
      suffix: '',
    });
    const launcher = page.locator('[data-component="SpaceLauncher"]');
    const actions = page.locator('[data-space-row="actions"]');
    await expect(page.locator('.themeHost').first()).toHaveCSS(
      'background-image',
      /linear-gradient/
    );
    await expectCanvasBehind(launcher);
    await expectCanvasBehind(actions);
    await expect(launcher.locator('button[data-game]').first()).toHaveCSS(
      'background-image',
      /linear-gradient/
    );

    const row = await actions.boundingBox();
    if (!row) throw new Error('Missing space header');
    const wide = width === 1280;
    // Desktop: the column's left edge; phone: where the header meets the stage.
    // Both samples are in the empty inset, clear of the toolbar and game art.
    const left = wide ? Math.round(row.x) - 1 : 1;
    const top = wide
      ? Math.ceil(row.y) + 1
      : Math.round(row.y + row.height) - 1;
    const shot = await page.screenshot({
      path: info.outputPath(`game-picker-canvas-${width}.png`),
      scale: 'css',
    });
    const pair = await sharp(shot)
      .extract({ left, top, width: wide ? 2 : 1, height: wide ? 1 : 2 })
      .removeAlpha()
      .raw()
      .toBuffer();
    for (const channel of [0, 1, 2]) {
      expect(
        Math.abs(pair.readUInt8(channel) - pair.readUInt8(channel + 3))
      ).toBeLessThanOrEqual(2);
    }
  }
});

test('screens-settings-index--default shares the viewport canvas on space-canvas-restarts-in-content', async ({
  page,
}) => {
  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    await verifyStoryScenario(page, 'screens-settings-index--default', {
      width,
      height,
      globals: {},
      suffix: '',
    });
    await expectCanvasBehind(page.locator('[data-screen="more"]'));
    if (width === 390)
      await expectCanvasBehind(
        page.locator('[data-component="ScreenBaseHeader"]')
      );
  }
});
