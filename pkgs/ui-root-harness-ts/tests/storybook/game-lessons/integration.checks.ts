import { expect, type Page, test } from '@playwright/test';

type Move = (page: Page) => Promise<void>;
const tap =
  (id: string): Move =>
  (page) =>
    page.getByTestId(id).click();
const pawn = tap('practice-board-action-e2');

async function openingWord(page: Page) {
  for (const [tile, cell] of [
    [11, 'g8'],
    [0, 'h8'],
    [80, 'i8'],
  ] as const) {
    await page.getByTestId(`word-tiles-puzzle-rack-${tile}`).click();
    await page.getByTestId(`word-tiles-puzzle-cell-${cell}`).click();
  }
  await page.getByTestId('word-tiles-puzzle-submit').click();
}
async function firstPath(page: Page) {
  const cell = (index: number) =>
    page.getByTestId(`numberlink-board-cell-${index}`);
  await cell(0).press('Enter');
  await cell(0).press('ArrowRight');
  await cell(1).press('ArrowRight');
  await cell(2).press('Enter');
}
const ride = (page: Page) =>
  page.getByTestId('practice-board-arena').press('ArrowUp');
const moves: Record<string, Move> = {
  quoridor: pawn,
  'quoridor-hill': pawn,
  'connect-four': tap('practice-board-column-4'),
  chess: async (page) => {
    await page.getByTestId('practice-board-square-e2').press('Enter');
    await page.getByTestId('practice-board-square-e4').press('Enter');
  },
  battleship: async (page) => {
    await page.getByTestId('practice-board-target-f10').click();
    await page.getByTestId('practice-board-fire').click();
  },
  hearts: tap('practice-board-card-2C'),
  pong: (page) => page.getByTestId('practice-board').press('ArrowUp'),
  sokoban: tap('sokoban-move-right'),
  numberlink: firstPath,
  'light-cycles': ride,
  'light-cycles-3': ride,
  'light-cycles-4': ride,
  'word-tiles': openingWord,
  'word-tiles-3': openingWord,
  'word-tiles-4': openingWord,
};

for (const [id, move] of Object.entries(moves)) {
  test(`storybook integration: guided practice in ${id}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(
      `/iframe.html?id=screens-game-home-how-to-play--first-move&args=gameId:${id}&viewMode=story`
    );
    const prompt = page.getByTestId('practice-prompt');
    await expect(prompt).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const before = await prompt.innerText();
    await expect(page.getByTestId('practice-next')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`${id}-before.png`) });
    await move(page);
    await expect(page.getByTestId('practice-next')).toBeEnabled();
    await expect(prompt).not.toHaveText(before);
    await prompt.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`${id}-after.png`) });
  });
}
