import { expect, type Page, test } from '@playwright/test';
import { captureBoard, openBoard } from '../capture';
import { boardContext } from '../matrix';

test.use(boardContext(320));

/** Where the board and everything after it sit, in page coordinates. */
async function layout(page: Page) {
  return page.evaluate(() => {
    const board = document.querySelector('[data-testid="custom-game-board"]');
    const rect = board?.getBoundingClientRect();
    return {
      boardTop: rect?.top ?? -1,
      boardHeight: rect?.height ?? -1,
      pageHeight: document.scrollingElement?.scrollHeight ?? -1,
    };
  });
}

// regression: connect-four-keyboard-help-layout-shift
test('storybook integration: connect-four keyboard help never moves the page', async ({
  page,
}, info) => {
  await openBoard(page, 'drop-a-disc', 'light');
  const column = page.getByTestId('custom-game-board-column-1');
  const help = page.getByTestId('custom-game-board-keyboard-help');
  const resting = await layout(page);
  await column.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(column).toBeFocused();
  await expect(help).toBeVisible();
  const focused = await layout(page);
  const fit = await help.evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }));
  await info.attach('keyboard-help-layout', {
    body: JSON.stringify({ resting, focused, fit }, null, 2),
    contentType: 'application/json',
  });
  await captureBoard(page, info, 'keyboard-help-reserved');
  expect(focused).toEqual(resting);
  // One whole line at the narrowest width: nothing cut off.
  expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth);
});

// regression: connect-four-win-rings-overlap-neighbours
test('storybook integration: connect-four win rings stay inside their cells', async ({
  page,
}, info) => {
  await openBoard(page, 'won', 'dark');
  const rings = await page
    .locator('[data-winning="true"]')
    .evaluateAll((cells) =>
      cells.map((cell) => {
        const style = getComputedStyle(cell);
        return {
          width: Number.parseFloat(style.outlineWidth),
          offset: Number.parseFloat(style.outlineOffset),
        };
      })
    );
  await info.attach('win-rings', {
    body: JSON.stringify(rings, null, 2),
    contentType: 'application/json',
  });
  await captureBoard(page, info, 'win-rings-320');
  expect(rings.length).toBeGreaterThanOrEqual(4);
  for (const ring of rings) {
    expect(ring.width).toBeGreaterThan(0);
    // An outline reaches past its box by offset + width; keep it inside.
    expect(ring.offset + ring.width).toBeLessThanOrEqual(0);
  }
});

// regression: connect-four-red-disc-low-contrast
test('storybook integration: connect-four discs and marks contrast with the hole', async ({
  page,
}, info) => {
  for (const theme of ['light', 'dark']) {
    await openBoard(page, 'your-turn', theme);
    const discs = await page.evaluate(() => {
      const rgb = (value: string) =>
        (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const luminance = ([r = 0, g = 0, b = 0]: number[]) =>
        [r, g, b]
          .map((channel) => {
            const c = channel / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          })
          .reduce(
            (sum, c, index) => sum + c * ([0.2126, 0.7152, 0.0722][index] ?? 0),
            0
          );
      const ratio = (a: string, b: string) => {
        const [high, low] = [luminance(rgb(a)), luminance(rgb(b))].sort(
          (x, y) => y - x
        );
        return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
      };
      return ['1', '2'].map((side) => {
        const cell = document.querySelector(`[data-disc="${side}"]`);
        const disc = cell?.querySelector('span');
        if (!cell || !disc) return { side, missing: true };
        const hole = getComputedStyle(cell).backgroundColor;
        const style = getComputedStyle(disc);
        const rim = /rgba?\([^)]*\)/.exec(style.boxShadow)?.[0] ?? hole;
        return {
          side,
          mark: ratio(style.color, style.backgroundColor),
          rim: ratio(rim, hole),
        };
      });
    });
    await info.attach(`disc-contrast-${theme}`, {
      body: JSON.stringify(discs, null, 2),
      contentType: 'application/json',
    });
    for (const disc of discs) {
      expect(disc).not.toHaveProperty('missing');
      // WCAG 1.4.11: a graphic's identifying edge and its mark need 3:1.
      expect(disc.mark).toBeGreaterThanOrEqual(3);
      expect(disc.rim).toBeGreaterThanOrEqual(3);
    }
  }
  await captureBoard(page, info, 'disc-contrast-dark');
});
