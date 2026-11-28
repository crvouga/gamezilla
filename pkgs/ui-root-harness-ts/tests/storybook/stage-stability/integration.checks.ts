import { expect, type Page, test } from '@playwright/test';

test.use({ trace: 'on' });

/**
 * A game played on one device, as its stage changes under the person: the
 * turn passes, the connection drops, a command is refused, a draw is
 * offered, the record grows, the game ends. Each step is a story of the
 * same stage; the page switches between them in place, as the app keeps
 * one page through a game, so the stage remounts as it does when the game
 * moves on to its result.
 */
const SEQUENCES = {
  'game session': [
    'screens-game-sessions-stage--no-moves-yet',
    'screens-game-sessions-stage--your-turn',
    'screens-game-sessions-stage--opponents-turn',
    'screens-game-sessions-stage--timed',
    'screens-game-sessions-stage--connection-needed',
    'screens-game-sessions-stage--choice-refused',
    'screens-game-sessions-stage--draw-offered',
    'screens-game-sessions-stage--long-record',
    'screens-game-sessions-result--you-win',
    'screens-game-sessions-result--draw',
  ],
  matchmaking: [
    'screens-matchmaking-stage--no-moves-yet',
    'screens-matchmaking-stage--matched',
    'screens-matchmaking-stage--offer-draw-now',
    'screens-matchmaking-stage--draw-offered',
    'screens-matchmaking-stage--offline',
    'screens-matchmaking-stage--command-refused',
    'screens-matchmaking-result--after-the-game',
    'screens-matchmaking-result--rematch-offered',
  ],
} as const;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
  barY: number;
  barHeight: number;
};

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

/** Where the board's surface lies, in whole pixels. */
async function boardRect(page: Page): Promise<Rect> {
  return page.evaluate(() => {
    const board = document.querySelector('[data-game-board]');
    if (!board) throw new Error('Missing the board');
    const rect = board.getBoundingClientRect();
    const bar = document
      .querySelector('[data-game-slot="controls"]')
      ?.getBoundingClientRect();
    if (!bar) throw new Error('Missing the action bar');
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      barY: Math.round(bar.y),
      barHeight: Math.round(bar.height),
    };
  });
}

/** Shows another story in the same page, without reloading it. */
async function switchTo(page: Page, storyId: string): Promise<void> {
  await page.evaluate((id) => {
    document
      .querySelector('#storybook-root')
      ?.removeAttribute('data-story-ready');
    const channel = (
      window as unknown as {
        __STORYBOOK_ADDONS_CHANNEL__?: {
          emit: (event: string, payload: unknown) => void;
        };
      }
    ).__STORYBOOK_ADDONS_CHANNEL__;
    if (!channel) throw new Error('Missing the Storybook channel');
    channel.emit('setCurrentStory', { storyId: id, viewMode: 'story' });
  }, storyId);
  await ready(page);
}

// regression: stage-board-pushed-by-notice
// On a 390px phone the connection notice was a row above the board, so the
// board dropped (up to 110px) when it appeared. The command bar's status
// line reports the lost connection while the board keeps its place.
test('storybook integration: stage stability 390 keeps the board in place when a notice appears', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    '/iframe.html?id=screens-game-sessions-stage--your-turn&viewMode=story&globals=theme:light'
  );
  await ready(page);
  await expect(page.getByTestId('game-session-connection-needed')).toHaveCount(
    0
  );
  const before = await boardRect(page);
  expect(before).toMatchObject({ x: 0, width: 390 });
  await switchTo(page, 'screens-game-sessions-stage--connection-needed');
  await expect(
    page.getByTestId('game-session-connection-needed')
  ).toBeVisible();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: "You're offline. Moves need a connection." })
  ).toBeVisible();
  expect(await boardRect(page)).toEqual(before);
});

// regression: stage-board-moves-on-result
// On a 390px phone the finished game's board drew smaller and lower than the
// live one, so it jumped when the game ended. The outcome card now lies over
// the board in a dialog: the board keeps its place and size once the result shows.
test('storybook integration: stage stability 390 keeps the board in place when the result card shows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    '/iframe.html?id=screens-game-sessions-stage--your-turn&viewMode=story&globals=theme:light'
  );
  await ready(page);
  await expect(page.getByRole('dialog', { name: 'Game over' })).toHaveCount(0);
  const before = await boardRect(page);
  expect(before).toMatchObject({ x: 0, width: 390 });
  await switchTo(page, 'screens-game-sessions-result--you-win');
  await expect(page.getByRole('dialog', { name: 'Game over' })).toBeVisible();
  expect(await boardRect(page)).toEqual(before);
});

// Every step of a game, on a phone and a wide window.
for (const viewport of VIEWPORTS)
  for (const [mode, stories] of Object.entries(SEQUENCES))
    test(`storybook integration: stage stability ${mode} ${viewport.width} keeps the board where it is through the game`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const [first, ...rest] = stories;
      await page.goto(
        `/iframe.html?id=${first}&viewMode=story&globals=theme:light`
      );
      await ready(page);
      const start = await boardRect(page);
      // A phone's board takes the screen's whole width.
      if (viewport.width < 768) {
        expect(start.x).toBe(0);
        expect(start.width).toBe(viewport.width);
      }
      for (const story of rest) {
        await switchTo(page, story);
        expect({ story, ...(await boardRect(page)) }).toEqual({
          story,
          ...start,
        });
      }
    });
