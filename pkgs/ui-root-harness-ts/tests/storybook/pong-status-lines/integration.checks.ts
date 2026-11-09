import { expect, test } from '@playwright/test';
import { openPong, recordPong } from '../pong-overhaul/evidence';
import { logSummary } from '../pong-overhaul/log-evidence';

test.use({ video: 'on', trace: 'on' });

// On a phone the court status broke mid-phrase ("Match / point").
// regression: pong-status-breaks-mid-phrase
test('storybook integration: pong-overhaul court status keeps each part on one line on a phone', async ({
  page,
}, info) => {
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPong(page, 'match-point', theme);
    const lines = await page
      .getByTestId('custom-game-board-status')
      .evaluate((status) => {
        const range = document.createRange();
        range.selectNodeContents(status);
        const tops = new Set(
          [...range.getClientRects()].map((rect) => Math.round(rect.top))
        );
        return {
          parts: status.textContent.split('\n'),
          lineBoxes: tops.size,
        };
      });
    logSummary('PONG_STATUS_LINES', { theme, ...lines });
    await recordPong(page, info, `status-lines-${theme}`);
    expect(lines.parts.length).toBeGreaterThanOrEqual(2);
    expect(lines.lineBoxes).toBe(lines.parts.length);
  }
});
