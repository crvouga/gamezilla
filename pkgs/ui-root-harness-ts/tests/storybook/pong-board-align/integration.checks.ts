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
  for (const theme of ['light', 'dark'])
    for (const viewport of [
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(
        `/iframe.html?id=screens-games-pong-court--rally&viewMode=story&globals=theme:${theme}`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      const title = await page
        .getByRole('heading', { name: 'Pong', exact: true })
        .boundingBox();
      const stage = await page
        .locator('[data-component="GameBoardStage"]')
        .first()
        .boundingBox();
      if (!title || !stage) throw new Error('Missing title or board geometry');
      // A phone's game is one fixed view whose board takes the frame's
      // whole width; on a tablet's one column the court starts under the
      // title. Never centred somewhere in between.
      if (viewport.width < 768) {
        expect(stage.x).toBe(0);
        expect(stage.width).toBe(viewport.width);
      } else expect(Math.abs(stage.x - title.x)).toBeLessThanOrEqual(1);
    }
});
