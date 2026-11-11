// @io-wall-ok — canonical browser evidence for the Word Tiles board.
import { expect, type Page, test } from '@playwright/test';
import {
  auditAccessibility,
  observeInput,
  openStory,
  recordEvidence,
} from './evidence';
import { playWord } from './native-input';
import { retainEvidence } from './retained-evidence';

test.use({ video: 'on', trace: 'on' });
test.beforeEach(async ({ page }) => observeInput(page));
test.afterEach(async ({ page }, info) => recordEvidence(page, info));

const stories = [
  'opening',
  'your-turn',
  'three-players',
  'four-players',
  'watching',
  'waiting-for-opponent',
  'game-over',
  'checking-words',
  'word-list-unavailable',
  'unreadable',
  'place-a-word',
  'assign-a-blank',
  'recall-and-restore',
  'recover-and-submit',
  'accepted-pass',
  'accepted-exchange',
  'enlarged-coordinates',
];
for (const theme of ['light', 'dark']) {
  test.describe(`word tiles ${theme}`, () => {
    for (const story of stories) {
      test(`storybook integration: word-tiles evidence ${story} ${theme}`, async ({
        page,
      }, info) => {
        await openStory(page, story, theme);
        await auditAccessibility(page, info);
      });
    }
    for (const size of [
      { width: 320, height: 740 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      test(`storybook integration: word-tiles opening ${theme} ${size.width}`, async ({
        page,
      }, info) => {
        await page.setViewportSize(size);
        await openStory(page, 'opening', theme);
        await auditAccessibility(page, info);
      });
    }
  });
}

for (const input of ['mouse', 'touch', 'keyboard'] as const) {
  test.describe(`native ${input}`, () => {
    test.use({ hasTouch: input === 'touch' });
    for (const players of ['two', 'three', 'four']) {
      test(`storybook integration: word-tiles native ${input} ${players} players`, async ({
        page,
      }, info) => {
        const session = await page.context().newCDPSession(page);
        await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await retainEvidence(info, 'conditions.json', {
          body: JSON.stringify({
            cpuRate: 4,
            input,
            players,
            viewport: page.viewportSize(),
            theme: 'light',
            motion: 'system',
          }),
          contentType: 'application/json',
        });
        await openStory(page, `${players}-player-match`, 'light');
        await playWord(page, input);
        await auditAccessibility(page, info);
      });
    }
  });
}

/** Row-label overflow on the fitted 1440x900 desktop opening. */
async function fittedDesktop(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStory(page, 'opening', 'light');
  return page.evaluate(() => {
    const board = document.querySelector<HTMLElement>(
      '[data-testid="custom-game-board"]'
    );
    const rows = Array.from(
      board?.querySelectorAll<HTMLElement>('[data-axis="row"]') ?? []
    );
    return {
      enlarged: board?.dataset['enlarged'],
      overflowing: rows
        .filter((row) => row.scrollWidth > row.clientWidth)
        .map((row) => row.textContent),
    };
  });
}

// regression: word-tiles-fitted-row-label-overflow
test('storybook integration: word-tiles 1440 fitted row labels keep their own gutter', async ({
  page,
}) => {
  const fitted = await fittedDesktop(page);
  expect(fitted.enlarged).toBe('false');
  expect(fitted.overflowing).toEqual([]);
});

// regression: word-tiles-find-square-reads-as-text
test('storybook integration: word-tiles find a square looks like an action on the phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStory(page, 'opening', 'light');
  const find = page.getByRole('button', { name: 'Find a square', exact: true });
  await expect(find).toHaveAttribute('aria-haspopup', 'dialog');
  const look = await find.evaluate((element) => {
    const css = getComputedStyle(element);
    const caption = Array.from(
      element.closest('[data-overview]')?.querySelectorAll('p') ?? []
    ).find((paragraph) => paragraph.textContent === 'View an area');
    const box = element.getBoundingClientRect();
    return {
      underline: css.textDecorationLine,
      weight: Number.parseInt(css.fontWeight, 10),
      color: css.color,
      captionColor: caption ? getComputedStyle(caption).color : '',
      width: box.width,
      height: box.height,
    };
  });
  expect(look.underline).toContain('underline');
  expect(look.weight).toBeGreaterThanOrEqual(600);
  expect(look.color).not.toBe(look.captionColor);
  expect(look.height).toBeGreaterThanOrEqual(44);
  expect(look.width).toBeGreaterThanOrEqual(44);
});

// regression: word-tiles-accepted-move-missing-from-record
test('storybook integration: word-tiles an accepted word appears in the move record', async ({
  page,
}) => {
  await openStory(page, 'two-player-match', 'light');
  await expect(page.getByTestId('custom-game-record')).toContainText(
    'No moves yet.'
  );
  await playWord(page, 'mouse');
  const strip = page.getByTestId('custom-game-record');
  await expect(strip).toContainText('CAT');
  await expect(strip).toContainText('10');
  await expect(strip).not.toContainText('No moves yet.');
});

// regression: word-tiles-preview-moves-board
test('storybook integration: word-tiles placing tiles does not move the board', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStory(page, 'two-player-match', 'light');
  const region = page.getByRole('region', { name: 'Scrollable word board' });
  const before = await region.boundingBox();
  const rack = page.getByTestId('custom-game-board-rack');
  // C then A: CA is not in the word list, but its score breakdown appears.
  await rack.getByRole('button').nth(0).click();
  await page.getByTestId('custom-game-board-cell-g8').click();
  await rack.getByRole('button').nth(1).click();
  await page.getByTestId('custom-game-board-cell-h8').click();
  await expect(page.getByTestId('custom-game-board-status')).toContainText(
    'Not in the word list: CA'
  );
  const after = await region.boundingBox();
  expect(after?.y).toBe(before?.y);
});

// regression: word-tiles-390-edge-inset
test('storybook integration: word-tiles keeps a 16px edge at 390 and 4px only at 320', async ({
  page,
}) => {
  const rackLeft = async (width: number, height: number) => {
    await page.setViewportSize({ width, height });
    await openStory(page, 'two-player-match', 'light');
    return (await page.getByTestId('custom-game-board-rack').boundingBox())?.x;
  };
  expect(await rackLeft(390, 844)).toBe(16);
  expect(await rackLeft(320, 740)).toBe(4);
});

// regression: word-tiles-desktop-rack-under-opponent
// regression: word-tiles-desktop-board-bounded-by-window-height
test('storybook integration: word-tiles desktop rack sits under a larger board beside the own seat', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStory(page, 'two-player-match', 'light');
  const box = (testId: string) =>
    page
      .getByTestId(testId)
      .first()
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, width: rect.width };
      });
  const board = await box('custom-game-board');
  const rack = await box('custom-game-board-rack');
  const seat = await box('custom-game-seat-near');
  // 28rem fitted board, up from 23rem before the overhaul.
  expect(board.width).toBeGreaterThanOrEqual(440);
  expect(rack.top).toBeGreaterThan(board.bottom);
  expect(seat.top).toBeGreaterThanOrEqual(rack.bottom);
  expect(seat.top - rack.bottom).toBeLessThanOrEqual(48);
  expect(seat.bottom).toBeLessThanOrEqual(900);
});

// regression: word-tiles-desktop-tab-order-skips-around
test('storybook integration: word-tiles desktop source order follows the screen: board, rack, then Play word', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStory(page, 'two-player-match', 'light');
  const order = await page.evaluate(() => {
    const board = document.querySelector('[data-testid="custom-game-board"]');
    const rack = document.querySelector(
      '[data-testid="custom-game-board-rack"]'
    );
    const submit = document.querySelector(
      '[data-testid="custom-game-board-submit"]'
    );
    if (!board || !rack || !submit) return null;
    const before = (a: Element, b: Element) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const rackBox = rack.getBoundingClientRect();
    const submitBox = submit.getBoundingClientRect();
    return {
      boardBeforeRack: before(board, rack),
      rackBeforeSubmit: before(rack, submit),
      submitBesideRack:
        submitBox.left >= rackBox.right &&
        submitBox.top < rackBox.bottom &&
        submitBox.bottom > rackBox.top,
    };
  });
  expect(order).toEqual({
    boardBeforeRack: true,
    rackBeforeSubmit: true,
    submitBesideRack: true,
  });
});

// regression: word-tiles-desktop-recovery-button-clipped
test('storybook integration: word-tiles desktop word-list recovery button shows its whole label', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStory(page, 'word-list-unavailable', 'light');
  const retry = page.getByRole('button', {
    name: 'Reload word list',
    exact: true,
  });
  await expect(retry).toBeVisible();
  const fit = await retry.evaluate((element) => ({
    overflow: element.scrollWidth - element.clientWidth,
    width: element.getBoundingClientRect().width,
  }));
  expect(fit.overflow).toBeLessThanOrEqual(0);
  expect(fit.width).toBeGreaterThanOrEqual(44);
});

// regression: word-tiles-focus-ring-invisible-on-dark-squares
test('storybook integration: word-tiles keyboard focus ring stands out on dark and light squares', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const theme of ['light', 'dark']) {
    await openStory(page, 'opening', theme);
    // b1 is an empty plain square (dark felt); a1 is a light bonus square.
    for (const id of ['b1', 'a1']) {
      const cell = page.getByTestId(`custom-game-board-cell-${id}`);
      await cell.focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowLeft');
      const best = await cell.evaluate((element) => {
        const parse = (value: string) =>
          (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const luminance = (rgb: number[]) => {
          const [r = 0, g = 0, b = 0] = rgb.map((channel) => {
            const c = channel / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const contrast = (a: number[], b: number[]) => {
          const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
          return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
        };
        const css = getComputedStyle(element);
        const background = parse(css.backgroundColor);
        const ring = parse(css.outlineColor);
        const inner = parse(css.boxShadow);
        return {
          focused: element.matches(':focus-visible'),
          contrast: Math.max(
            contrast(ring, background),
            contrast(inner, background)
          ),
        };
      });
      expect(best.focused, `${theme} ${id} focus-visible`).toBe(true);
      expect(
        best.contrast,
        `${theme} ${id} ring contrast`
      ).toBeGreaterThanOrEqual(3);
    }
  }
});

// regression: word-tiles-board-drops-after-submit
test('storybook integration: word-tiles the board stays put within its workspace when a played word passes the turn', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStory(page, 'two-player-match', 'light');
  // Measured from the top of the Word Tiles workspace: the shared status
  // card above it is outside this game's layout.
  const offset = async () =>
    page.evaluate(() => {
      const workspace = document.querySelector(
        '[data-component="WordTileWorkspace"]'
      );
      const board = document.querySelector(
        '[aria-label="Scrollable word board"]'
      );
      if (!workspace || !board) return null;
      return (
        board.getBoundingClientRect().top -
        workspace.getBoundingClientRect().top
      );
    });
  const before = await offset();
  await playWord(page, 'mouse');
  await expect(page.getByTestId('custom-game-record')).toContainText('CAT');
  await expect(page.getByTestId('custom-game-board-status')).toHaveText(
    'Plan your next word while you wait.'
  );
  expect(before).not.toBeNull();
  expect(await offset()).toBe(before);
});

// regression: word-tiles-status-line-wraps-moves-board
test('storybook integration: word-tiles phone status line stays one line while words are checked', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const status = page.getByTestId('custom-game-board-status');
  const height = async () =>
    status.evaluate((element) => element.getBoundingClientRect().height);
  await openStory(page, 'opening', 'light');
  const oneLine = await height();
  for (const [story, text] of [
    ['checking-words', 'checking words'],
    ['place-a-word', 'CAT 5 × 2 = 10 points'],
  ] as const) {
    await openStory(page, story, 'light');
    await expect(status).toContainText(text);
    expect(await height(), story).toBe(oneLine);
  }
});

// regression: word-tiles-desktop-own-seat-below-fold
test('storybook integration: word-tiles desktop keeps the own seat whole in an 844px-tall window', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 844 });
  for (const story of [
    'two-player-match',
    'place-a-word',
    'enlarged-coordinates',
    'word-list-unavailable',
    'game-over',
  ]) {
    await openStory(page, story, 'light');
    const seat = await page
      .getByTestId('custom-game-seat-near')
      .first()
      .evaluate((element) => element.getBoundingClientRect().bottom);
    expect(seat, story).toBeLessThanOrEqual(844);
  }
});

// regression: word-tiles-desktop-view-controls-jump
test('storybook integration: word-tiles desktop keeps Fit and Enlarge in one place in both views', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 844 });
  await openStory(page, 'opening', 'light');
  const fit = page.getByRole('button', { name: 'Fit board', exact: true });
  const enlarge = page.getByRole('button', {
    name: 'Enlarge board',
    exact: true,
  });
  const before = await fit.boundingBox();
  await enlarge.click();
  await expect(enlarge).toHaveAttribute('aria-pressed', 'true');
  await expect(fit).toHaveCount(1);
  const after = await fit.boundingBox();
  expect([after?.x, after?.y]).toEqual([before?.x, before?.y]);
});

// regression: word-tiles-bonus-squares-one-colour
test('storybook integration: word-tiles bonus squares are told apart by colour as well as text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 844 });
  for (const theme of ['light', 'dark']) {
    await openStory(page, 'opening', theme);
    const fills = await page.evaluate(() => {
      const board = document.querySelector('[data-testid="custom-game-board"]');
      const fill = (square: string) => {
        const cell = board?.querySelector(
          `[data-state="empty"][data-square="${square}"]`
        );
        return cell ? getComputedStyle(cell).backgroundColor : null;
      };
      return ['DL', 'TL', 'DW', 'TW'].map(fill);
    });
    expect(
      fills.every((value) => value !== null),
      theme
    ).toBe(true);
    expect(new Set(fills).size, theme).toBe(4);
  }
});
