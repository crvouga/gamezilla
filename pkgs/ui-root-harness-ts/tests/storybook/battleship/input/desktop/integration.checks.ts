import { expect, test } from '@playwright/test';
import { retainEvidence } from '../../../word-tiles/retained-evidence';
import { openBattleStory } from '../../evidence';
import { defineInputChecks } from '../checks';
import { defineLockedInspectionChecks } from '../locked-checks';

const viewport = { width: 1440, height: 900 };
test.use({
  viewport,
  hasTouch: true,
  video: { mode: 'on', size: viewport },
  trace: 'on',
});

test.describe('desktop', () => {
  defineInputChecks();
  defineLockedInspectionChecks();
});

// regression: battleship-desktop-fire-below-fold
test('storybook integration: battleship desktop first view fits target and confirmation', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 844 });
  await openBattleStory(
    page,
    'screens-games-battleship-board--your-turn',
    info
  );
  const grid = page.getByTestId('game-session-board-target-grid');
  const corner = page.getByTestId('game-session-board-target-j10');
  const fire = page.getByTestId('game-session-board-fire');
  const cancel = page.getByTestId('game-session-board-cancel-aim');
  await expect(grid).toBeInViewport({ ratio: 1 });
  await expect(fire).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('game-session-seat-near')).toBeInViewport({
    ratio: 1,
  });
  await expect(page.locator('[data-game-slot="controls"]')).toBeInViewport({
    ratio: 1,
  });
  const target = await grid.boundingBox();
  await page.screenshot({ path: info.outputPath('desktop-first-view.png') });
  await corner.click();
  await expect(fire).toHaveText('Fire at J10');
  await expect(fire).toBeInViewport({ ratio: 1 });
  await expect(cancel).toBeInViewport({ ratio: 1 });
  await expect(cancel).toBeEnabled();
  expect(await grid.boundingBox()).toEqual(target);
  await retainEvidence(info, 'desktop-aim-geometry.json', {
    body: JSON.stringify({
      viewport: page.viewportSize(),
      target,
      j10: await corner.boundingBox(),
      fire: await fire.boundingBox(),
      cancel: await cancel.boundingBox(),
    }),
    contentType: 'application/json',
  });
  await page.screenshot({ path: info.outputPath('desktop-aim-j10.png') });
});
