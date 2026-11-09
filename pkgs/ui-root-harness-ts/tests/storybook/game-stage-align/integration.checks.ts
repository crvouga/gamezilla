import { expect, test } from '@playwright/test';

const viewport = { width: 768, height: 1024 };
test.use({ viewport });

// regression: game-stage-pinned-to-start-on-one-column
test('storybook integration: a centred stage sits in the middle of a one-column layout at 768', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=templates-matchmaking-game--stage-centred&viewMode=story'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  const layout = await page
    .locator('[data-component="GameLayout"]')
    .boundingBox();
  const stage = await page.getByTestId('stage-probe').boundingBox();
  if (!layout || !stage) throw new Error('The layout or its stage is missing');
  // The stage stops short of the column, so where it sits is observable.
  expect(stage.width).toBeLessThan(layout.width - 40);
  const before = stage.x - layout.x;
  const after = layout.x + layout.width - (stage.x + stage.width);
  expect(Math.abs(before - after)).toBeLessThanOrEqual(1);
});
