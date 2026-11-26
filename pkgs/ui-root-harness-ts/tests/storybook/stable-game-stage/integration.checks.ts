import { expect, type Locator, type Page, test } from '@playwright/test';

async function open(page: Page, story: string) {
  await page.goto(`/iframe.html?id=${story}&viewMode=story`);
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

async function rect(node: Locator) {
  const box = await node.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0)
    throw new Error(`Missing ${node.toString()}`);
  return box;
}

async function frame(page: Page) {
  const board = await rect(page.locator('[data-game-board]'));
  const host = await rect(page.locator('[data-game-column]'));
  const actions = await rect(page.locator('[data-game-slot="controls"]'));
  expect(board.width).toBeCloseTo(host.width, 0);
  expect(board.x).toBeCloseTo(host.x, 0);
  expect(board.y + board.height).toBeLessThanOrEqual(actions.y + 1);
  expect(actions.y + actions.height).toBeLessThanOrEqual(
    await page.evaluate(() => innerHeight + 1)
  );
  for (const band of await page
    .locator(
      '[data-game-players] > *, [data-component="GameStageStatus"], [data-game-slot="history"]'
    )
    .all()) {
    const info = await band.boundingBox();
    if (info && info.height > 0)
      expect(info.y + info.height).toBeLessThanOrEqual(board.y + 1);
  }
  return { board, actions };
}

// regression: quoridor-history-pushes-board
test('stable game stage keeps the reported Quoridor positions on phone and tablet', async ({
  page,
}, info) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1153, height: 2000 },
  ]) {
    await page.setViewportSize(viewport);
    let previous;
    for (const [story, moves] of [
      ['both-pawns-advanced', 4],
      ['pawns-passed', 8],
    ] as const) {
      await open(page, `screens-games-quoridor-classic--${story}`);
      const history = page.locator('[data-game-slot="history"]');
      await expect(
        history.getByTestId(`custom-game-review-move-${moves}`)
      ).toBeVisible();
      await expect(
        history.getByRole('button', { name: 'All moves' })
      ).toBeVisible();
      const boxes = await frame(page);
      const grid = await rect(page.getByTestId('custom-game-board'));
      expect(grid.width).toBeCloseTo(boxes.board.width, 0);
      const cell = await rect(
        page.getByTestId('custom-game-board').locator('[data-cell]').first()
      );
      expect(cell.height).toBeCloseTo(cell.width, 0);
      const geometry = {
        ...boxes,
        grid,
        history: await rect(history),
        status: await rect(page.locator('[data-component="GameStageStatus"]')),
        space: await rect(page.locator('[data-space-row="actions"]')),
      };
      if (previous) expect(geometry).toEqual(previous);
      previous = geometry;
      const name = `quoridor-${viewport.width}x${viewport.height}-move-${moves}.png`;
      const path = info.outputPath(name);
      await page.screenshot({ path });
      await info.attach(name, { path, contentType: 'image/png' });
    }
  }
});

// regression: quoridor-hill-desktop-board-below-target-size
test('stable game stage centres playable Quoridor squares in a height-limited desktop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'screens-games-quoridor-hill--four-player-round');
  const { board } = await frame(page);
  const grid = await rect(page.getByTestId('custom-game-board'));
  expect(grid.x + grid.width / 2).toBeCloseTo(board.x + board.width / 2, 0);
  expect(
    (
      await rect(
        page.getByTestId('custom-game-board').locator('[data-cell]').first()
      )
    ).width
  ).toBeGreaterThanOrEqual(44);
});

const consumers = [
  'screens-games-chess-board--your-turn',
  'screens-games-connect-four-board--your-turn',
  'screens-games-quoridor-classic--both-pawns-advanced',
  'screens-games-quoridor-hill--waiting-for-others',
  'screens-games-word-tiles-board--two-player-match',
  'screens-games-battleship-board--opening',
  'screens-games-hearts-board--waiting-for-turn',
  'screens-games-pong-stage--rally',
  'screens-games-light-cycles-stage--riding',
  'screens-custom-games-stage-moves--long-record',
  'screens-custom-games-result--you-win',
  'screens-matchmaking-private-setup--waiting',
  'screens-matchmaking-stage--matched',
  'screens-matchmaking-stage-moves--reviewing',
  'screens-matchmaking-result--after-the-game',
  'screens-history-replay--long-game',
];

for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test.describe(`stable game stage at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    for (const story of consumers) {
      test(story, async ({ page }, info) => {
        await open(page, story);
        await frame(page);
        if (viewport.width === 390) {
          const path = info.outputPath(story + '.png');
          await page.screenshot({ path });
          await info.attach(story, { path, contentType: 'image/png' });
        }
      });
    }
    test('parameterized space game', async ({ page }) => {
      await open(page, 'space-in-game--screen');
      const bar = await rect(page.locator('[data-space-row="actions"]'));
      const players = await rect(
        page.locator('[data-component="SpacePeopleRow"]')
      );
      const status = await rect(
        page
          .locator('[data-space-board]')
          .locator('xpath=preceding-sibling::*[1]')
      );
      const board = await rect(page.locator('[data-space-board]'));
      const actions = await rect(
        page.getByRole('group', { name: 'Game actions' })
      );
      expect(players.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
      expect(status.y).toBeGreaterThanOrEqual(players.y + players.height - 1);
      expect(board.y).toBeGreaterThanOrEqual(status.y + status.height - 1);
      expect(board.width).toBeCloseTo(bar.width, 0);
      expect(actions.y).toBeCloseTo(board.y + board.height, 0);
      expect(actions.y + actions.height).toBeLessThanOrEqual(
        viewport.height + 1
      );
    });
  });
}

test.describe('game menu and puzzle stage evidence', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const [story, selector] of [
    ['screens-game-home--with-puzzles-and-settings', '[data-layout="hero"]'],
    ['screens-matchmaking-time-control--choices', '[aria-pressed="true"]'],
    [
      'screens-matchmaking-searching--searching',
      '[data-testid="multiplayer-screen"]',
    ],
    ['screens-puzzles-stage--solving', '[data-component="PuzzleBoard"]'],
    ['screens-games-sokoban-puzzle--in-progress', '[data-testid]'],
    ['screens-games-numberlink-puzzle--in-progress', '[data-testid]'],
  ] as const) {
    test(story, async ({ page }, info) => {
      await open(page, story);
      await expect(page.locator(selector).first()).toBeVisible();
      const path = info.outputPath(story + '.png');
      await page.screenshot({ path });
      await info.attach(story, { path, contentType: 'image/png' });
    });
  }
});
