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
  'custom game': [
    'screens-custom-games-stage--no-moves-yet',
    'screens-custom-games-stage--your-turn',
    'screens-custom-games-stage--opponents-turn',
    'screens-custom-games-stage--timed',
    'screens-custom-games-stage--connection-needed',
    'screens-custom-games-stage--choice-refused',
    'screens-custom-games-stage--draw-offered',
    'screens-custom-games-stage--long-record',
    'screens-custom-games-result--you-win',
    'screens-custom-games-result--draw',
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
  { width: 1440, height: 900 },
] as const;

type Rect = { x: number; y: number; width: number };

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
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
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
