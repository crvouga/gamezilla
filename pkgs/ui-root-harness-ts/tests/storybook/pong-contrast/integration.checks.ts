import { contrastRatio, parseColor } from '@pkgs/ui-root-shared-ts/contrast';
import { expect, test } from '@playwright/test';
import { openPong, recordPong } from '../pong-overhaul/evidence';

test.use({ video: 'on', trace: 'on' });

// regression: pong-uncontrolled-paddle-contrast
test('storybook integration: pong-overhaul spectator paddle boundaries remain visible', async ({
  page,
}, info) => {
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPong(page, 'watching', theme);
    const colors = await page.getByRole('application').evaluate((court) => ({
      background: getComputedStyle(court).backgroundColor,
      paddles: [
        ...court.querySelectorAll('rect[data-side][data-controlled]'),
      ].map((paddle) => {
        const style = getComputedStyle(paddle);
        return {
          fill: style.fill,
          stroke: style.stroke,
          width: Number.parseFloat(style.strokeWidth),
        };
      }),
    }));
    const background = parseColor(colors.background);
    if (!background)
      throw new Error(`Invalid court color: ${colors.background}`);
    await info.attach(`paddle-colors-${theme}`, {
      body: JSON.stringify(colors),
      contentType: 'application/json',
    });
    await recordPong(page, info, `spectator-contrast-${theme}`);
    expect(colors.paddles).toHaveLength(2);
    for (const paddle of colors.paddles) {
      const fill = parseColor(paddle.fill);
      const stroke = parseColor(paddle.stroke);
      const fillContrast = fill ? contrastRatio(fill, background) : 0;
      const edgeContrast =
        stroke && paddle.width >= 2 ? contrastRatio(stroke, background) : 0;
      expect(Math.max(fillContrast, edgeContrast)).toBeGreaterThanOrEqual(3);
    }
  }
});
