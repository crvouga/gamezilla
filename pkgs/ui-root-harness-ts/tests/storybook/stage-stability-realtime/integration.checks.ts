import { expect, type Page, test } from '@playwright/test';

test.use({ trace: 'on' });

/**
 * A game played in real time on one device, as its stage changes under the
 * person: the serve counts down, a rally runs, a point is scored and the
 * score changes, play pauses and the connection drops, the game ends on its
 * result. Each step is a story of the same person's stage; the page
 * switches between them in place, as the app keeps one page through a game.
 * Both the board's place and its drawing (the court, the arena) are held:
 * nothing written around the drawing may push it either.
 */
const SEQUENCES = {
  pong: {
    drawing: '[data-testid="game-session-board-drawing"]',
    stories: [
      'screens-games-pong-stage--countdown',
      'screens-games-pong-stage--rally',
      'screens-games-pong-stage--serve-after-point',
      'screens-games-pong-stage--match-point',
      'screens-games-pong-stage--paused',
      'screens-games-pong-stage--reconnecting',
      'screens-games-pong-stage--finished',
    ],
  },
  'light cycles': {
    drawing: '[data-testid="game-session-board-arena-drawing"]',
    stories: [
      'screens-games-light-cycles-stage--countdown',
      'screens-games-light-cycles-stage--riding',
      'screens-games-light-cycles-stage--round-over',
      'screens-games-light-cycles-stage--reconnecting',
      'screens-games-light-cycles-stage--riding-elsewhere',
      'screens-games-light-cycles-stage--finished',
    ],
  },
} as const;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

type Rect = { x: number; y: number; width: number };
type Stage = { board: Rect; drawing: Rect };

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

/** Where the board and its drawing lie, in whole pixels. */
async function stageRects(page: Page, drawing: string): Promise<Stage> {
  return page.evaluate((selector) => {
    const rect = (element: Element | null, name: string) => {
      if (!element) throw new Error(`Missing the ${name}`);
      const box = element.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
      };
    };
    return {
      board: rect(document.querySelector('[data-game-board]'), 'board'),
      drawing: rect(document.querySelector(selector), 'drawing'),
    };
  }, drawing);
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

/** Steps through `game`'s stories at `viewport`: the arena never moves. */
async function keepsArenaInPlace(
  page: Page,
  viewport: (typeof VIEWPORTS)[number],
  game: keyof typeof SEQUENCES
): Promise<void> {
  const sequence = SEQUENCES[game];
  await page.setViewportSize(viewport);
  const [first, ...rest] = sequence.stories;
  await page.goto(`/iframe.html?id=${first}&viewMode=story`);
  await ready(page);
  const start = await stageRects(page, sequence.drawing);
  // A phone's arena takes the screen's whole width (its drawing keeps
  // its own frame and the room around its walls inside that).
  if (viewport.width < 768)
    expect(start.board).toMatchObject({ x: 0, width: viewport.width });
  for (const story of rest) {
    await switchTo(page, story);
    if (story === 'screens-games-light-cycles-stage--riding-elsewhere') {
      const claim = page
        .locator('[data-game-slot="controls"]')
        .getByRole('button', {
          name: 'Ride from this device',
        });
      await expect(claim).toBeEnabled();
      await expect(claim).toBeInViewport({ ratio: 1 });
    }
    expect({
      story,
      ...(await stageRects(page, sequence.drawing)),
    }).toEqual({ story, ...start });
  }
}

const [PHONE, WIDE] = VIEWPORTS;

// regression: realtime-stage-arena-moves
test('storybook integration: stage stability pong 390 keeps the arena where it is through the game', async ({
  page,
}) => {
  await keepsArenaInPlace(page, PHONE, 'pong');
});

test('storybook integration: stage stability pong 1440 keeps the arena where it is through the game', async ({
  page,
}) => {
  await keepsArenaInPlace(page, WIDE, 'pong');
});

// regression: light-cycles-device-transfer-resizes-arena
test('storybook integration: stage stability light cycles 390 keeps the arena where it is through the game', async ({
  page,
}) => {
  await keepsArenaInPlace(page, PHONE, 'light cycles');
});

test('storybook integration: stage stability light cycles 1440 keeps the arena where it is through the game', async ({
  page,
}) => {
  await keepsArenaInPlace(page, WIDE, 'light cycles');
});
