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
test('storybook integration: word-tiles narrow two players light keeps full rack targets', async ({
  page,
}, info) => {
  await narrowWorkspace(page, info, { players: 'two', theme: 'light' });
});

for (const fixture of [
  { players: 'two', theme: 'dark' },
  { players: 'three', theme: 'light' },
  { players: 'three', theme: 'dark' },
  { players: 'four', theme: 'light' },
  { players: 'four', theme: 'dark' },
]) {
  test(`storybook integration: word-tiles narrow ${fixture.players} players ${fixture.theme} keeps full rack targets`, async ({
    page,
  }, info) => {
    await narrowWorkspace(page, info, fixture);
  });
}

// regression: word-tiles-320-rack-wraps-board-below-fold
for (const players of ['two', 'three', 'four']) {
  test(`storybook integration: word-tiles narrow ${players} players opening fits without scrolling`, async ({
    page,
  }, info) => {
    await narrowOpeningFits(page, info, { players, theme: 'light' });
  });
}
