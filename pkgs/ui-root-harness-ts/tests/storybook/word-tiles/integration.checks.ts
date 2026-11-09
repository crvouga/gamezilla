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
  await expect(page.getByTestId('custom-game-move-strip')).toContainText(
    'No moves yet.'
  );
  await playWord(page, 'mouse');
  const strip = page.getByTestId('custom-game-move-strip');
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
  await expect(page.getByTestId('custom-game-board-breakdown')).toContainText(
    'CA'
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
  // 27rem fitted board, up from 23rem.
  expect(board.width).toBeGreaterThanOrEqual(420);
  expect(rack.top).toBeGreaterThan(board.bottom);
  expect(seat.top).toBeGreaterThanOrEqual(rack.bottom);
  expect(seat.top - rack.bottom).toBeLessThanOrEqual(48);
  expect(seat.bottom).toBeLessThanOrEqual(900);
});
