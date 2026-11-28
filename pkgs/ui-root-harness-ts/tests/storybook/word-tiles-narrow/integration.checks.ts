import { test } from '@playwright/test';
import { observeInput, recordEvidence } from '../word-tiles/evidence';
import { narrowOpeningFits, narrowWorkspace } from './narrow-workspace';

test.use({
  video: 'on',
  trace: 'on',
  hasTouch: true,
  viewport: { width: 320, height: 740 },
});
test.beforeEach(async ({ page }) => observeInput(page));
test.afterEach(async ({ page }, info) => recordEvidence(page, info));

// regression: word-tiles-narrow-rack-targets
test('storybook integration: word-tiles narrow two players keeps full rack targets', async ({
  page,
}, info) => {
  await narrowWorkspace(page, info, 'two');
});

for (const players of ['three', 'four']) {
  test(`storybook integration: word-tiles narrow ${players} players keeps full rack targets`, async ({
    page,
  }, info) => {
    await narrowWorkspace(page, info, players);
  });
}

// regression: word-tiles-320-rack-wraps-board-below-fold
test('storybook integration: word-tiles narrow two players opening fits without scrolling', async ({
  page,
}, info) => {
  await narrowOpeningFits(page, info, 'two');
});

for (const players of ['three', 'four']) {
  test(`storybook integration: word-tiles narrow ${players} players opening fits without scrolling`, async ({
    page,
  }, info) => {
    await narrowOpeningFits(page, info, players);
  });
}
