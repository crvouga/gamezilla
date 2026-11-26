import { expect, test } from '@playwright/test';
import { openPong, recordPong } from '../pong-overhaul/evidence';
import { logSummary, logVideo } from '../pong-overhaul/log-evidence';

test.use({ video: 'on', trace: 'on' });

// regression: pong-landscape-court-overflows-window
// regression: pong-landscape-court-below-fold-on-load
// regression: pong-landscape-court-under-floor
test('storybook integration: pong-overhaul landscape court and the points fit after keyboard focus', async ({
  page,
}, info) => {
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 844, height: 390 });
    await openPong(page, 'paddle-movement', theme);
    const court = page.getByRole('application', { name: 'Pong court' });
    // Before anything is focused, the whole court already shows.
    const firstView = await court.evaluate((element) => ({
      bottom: element.getBoundingClientRect().bottom,
      height: innerHeight,
    }));
    expect(firstView.bottom).toBeLessThanOrEqual(firstView.height);
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab');
      if (await court.evaluate((element) => element === document.activeElement))
        break;
    }
    await expect(court).toBeFocused();
    const fit = await court.evaluate((element) => {
      // A phone on its side: the stage drops its seat rows and the court
      // shows the points on its own scoreboard, so it keeps its height.
      const frame = element.parentElement?.parentElement;
      const scoreboard = frame?.querySelector('[data-testid$="-scoreboard"]');
      if (!scoreboard) throw new Error("Missing the court's scoreboard");
      const seats = [
        ...document.querySelectorAll('[data-component="GamePlayerBar"]'),
      ].filter((seat) => seat.getClientRects().length > 0).length;
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
        seats,
      };
    });
    await info.attach(`landscape-fit-${theme}`, {
      body: JSON.stringify(fit, null, 2),
      contentType: 'application/json',
    });
    logSummary('PONG_FIT', { theme, ...fit });
    await recordPong(page, info, `landscape-focus-${theme}`);
    expect(fit.scoreboard.top).toBeGreaterThanOrEqual(0);
    expect(fit.scoreboardUnobstructed).toBe(true);
    expect(fit.seats).toBeGreaterThan(0);
    expect(fit.court.bottom).toBeLessThanOrEqual(fit.viewport.height);
    expect(fit.court.height).toBeGreaterThan(0);
  }
  await logVideo(page, 'landscape-focus');
});
