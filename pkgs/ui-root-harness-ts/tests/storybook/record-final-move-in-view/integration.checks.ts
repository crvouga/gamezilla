import { expect, test } from '@playwright/test';

test.use({ video: 'on', trace: 'on', viewport: { width: 1440, height: 844 } });

// regression: record-final-move-scrolled-out-of-view
test('storybook integration: a finished game record shows its final move, marked, at the end', async ({
  page,
}, info) => {
  const seen: Record<string, unknown>[] = [];
  for (const story of ['won', 'lost', 'sink-the-fleet']) {
    await page.goto(
      `/iframe.html?id=screens-games-battleship-board--${story}&viewMode=story&globals=theme:light`
    );
    await expect(page.locator('#storybook-root')).toHaveAttribute(
      'data-story-ready',
      'true'
    );
    const list = page.locator('[data-layout="table"]').first();
    await expect(list).toBeVisible();
    // The list keeps the marked move in view once its size settles.
    await expect
      .poll(async () =>
        list.evaluate((node) => {
          const buttons = [...node.querySelectorAll('button')];
          const marked = node.querySelector('[aria-current="step"]');
          if (!marked) return 'no current move';
          if (marked !== buttons.at(-1)) return 'current is not the last move';
          const box = node.getBoundingClientRect();
          const move = marked.getBoundingClientRect();
          return move.top >= box.top - 1 && move.bottom <= box.bottom + 1
            ? 'in view'
            : `out of view (${String(Math.round(move.bottom - box.bottom))}px below)`;
        })
      )
      .toBe('in view');
    seen.push({
      story,
      scrollTop: await list.evaluate((node) => node.scrollTop),
    });
    const path = info.outputPath(`final-move-${story}.png`);
    await page.screenshot({ path });
    await info.attach(`final-move-${story}`, {
      path,
      contentType: 'image/png',
    });
  }
  await info.attach('record-scroll', {
    body: JSON.stringify(seen, null, 2),
    contentType: 'application/json',
  });
});
