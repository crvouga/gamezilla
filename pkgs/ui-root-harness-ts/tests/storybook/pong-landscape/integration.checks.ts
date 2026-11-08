import { expect, test } from '@playwright/test';
import { openPong, recordPong } from '../pong-overhaul/evidence';

test.use({ video: 'on', trace: 'on' });

// regression: pong-landscape-court-overflows-window
test('storybook integration: pong-overhaul landscape court and scoreboard fit after keyboard focus', async ({
  page,
}, info) => {
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 844, height: 390 });
    await openPong(page, 'paddle-movement', theme);
    const court = page.getByRole('application', { name: 'Pong court' });
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab');
      if (await court.evaluate((element) => element === document.activeElement))
        break;
    }
    await expect(court).toBeFocused();
    const fit = await court.evaluate((element) => {
      const frame = element.parentElement?.parentElement;
      const scoreboard = frame?.querySelector('[data-testid$="-scoreboard"]');
      if (!scoreboard) throw new Error('Missing Pong scoreboard');
      const board = scoreboard.getBoundingClientRect();
      const play = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        board.x + board.width / 2,
        board.y + board.height / 2
      );
      return {
        viewport: { width: innerWidth, height: innerHeight },
        scoreboard: { top: board.top, bottom: board.bottom },
        court: { top: play.top, bottom: play.bottom, height: play.height },
        scoreboardUnobstructed: hit !== null && scoreboard.contains(hit),
      };
    });
    await info.attach(`landscape-fit-${theme}`, {
      body: JSON.stringify(fit, null, 2),
      contentType: 'application/json',
    });
    await recordPong(page, info, `landscape-focus-${theme}`);
    expect(fit.scoreboard.top).toBeGreaterThanOrEqual(0);
    expect(fit.scoreboardUnobstructed).toBe(true);
    expect(fit.court.bottom).toBeLessThanOrEqual(fit.viewport.height);
    // Still a usable court: at least three fifths of the window height.
    expect(fit.court.height).toBeGreaterThanOrEqual(fit.viewport.height * 0.6);
  }
});
