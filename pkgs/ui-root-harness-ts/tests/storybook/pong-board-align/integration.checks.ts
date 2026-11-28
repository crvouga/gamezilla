// @io-wall-ok — automated geometry check; all navigation stays on the test server.
import { expect, test } from '@playwright/test';

// On a tablet's one column, the Pong court sat centred, 40px in from the
// game title above it. A phone's court spans the frame instead (#379).
// regression: board-stage-centred-off-title-edge
test('storybook integration: pong board starts under the game title on one column', async ({
  page,
}) => {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(
      `/iframe.html?id=screens-games-pong-stage--rally&viewMode=story`
    );
    await expect(page.locator('#storybook-root')).toHaveAttribute(
      'data-story-ready',
      'true'
    );
    const host = await page.locator('[data-game-column]').boundingBox();
    const stage = await page.locator('[data-game-board]').boundingBox();
    if (!host || !stage) throw new Error('Missing game column or board');
    expect(stage.x).toBeCloseTo(host.x, 0);
    expect(stage.width).toBeCloseTo(host.width, 0);
  }
});
