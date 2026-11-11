import { expect, type Locator, type Page, test } from '@playwright/test';

async function openGame(page: Page, story: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(
    `/iframe.html?id=${story}&viewMode=story&globals=theme:light`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

/** Named facts and commands must fit their own surface without clipping. */
async function containedItems(containers: Locator, selector: string) {
  return containers.evaluateAll(
    (elements, itemSelector) =>
      elements.flatMap((container) => {
        const outer = container.getBoundingClientRect();
        return Array.from(container.querySelectorAll(itemSelector)).flatMap(
          (item) => {
            const inner = item.getBoundingClientRect();
            const contained =
              item.checkVisibility() &&
              inner.width > 0 &&
              inner.height > 0 &&
              inner.left >= outer.left &&
              inner.right <= outer.right &&
              inner.top >= outer.top &&
              inner.bottom <= outer.bottom;
            return contained
              ? []
              : [
                  {
                    item:
                      item.textContent || item.getAttribute('data-component'),
                    surface: container.textContent,
                    inner: [inner.left, inner.right, inner.top, inner.bottom],
                    outer: [outer.left, outer.right, outer.top, outer.bottom],
                  },
                ];
          }
        );
      }),
    selector
  );
}

// regression: word-tiles-three-player-facts-overflow
test('storybook integration: three Word Tiles players keep every fact inside its seat', async ({
  page,
}) => {
  const facts =
    '[data-component="GameSeatSwatch"], [data-component="GameSeatStat"], [data-component="Badge"]';
  // A watcher's table: every seat's score (up to two digits) and rack count.
  await openGame(page, 'screens-games-word-tiles-board--three-players', 390);
  const chips = page.locator('[data-component="GamePlayerChip"]');
  await expect(chips).toHaveCount(3);
  await expect(chips.getByText('7 tiles', { exact: true })).toHaveCount(3);
  await expect(chips.getByText('10', { exact: true })).toBeVisible();
  expect(await containedItems(chips, facts)).toEqual([]);
  // A seated player's own chip says one thing, `You` (their rack is in
  // view under the seats); the other seats keep their rack counts.
  await openGame(
    page,
    'screens-games-word-tiles-board--three-player-match',
    390
  );
  await expect(chips).toHaveCount(3);
  await expect(chips.getByText('7 tiles', { exact: true })).toHaveCount(2);
  await expect(chips.getByText('You', { exact: true })).toBeVisible();
  expect(await containedItems(chips, facts)).toEqual([]);
});

for (const sample of [
  {
    story: 'screens-games-quoridor-hill--opening',
    commands: ['Move pawn', 'Horizontal wall', 'Vertical wall'],
  },
  {
    story: 'screens-games-word-tiles-board--your-turn',
    commands: ['Play word', 'Recall tiles', 'Undo', 'Redo'],
  },
]) {
  // regression: desktop-game-record-command-clipping
  test(`storybook integration: ${sample.story} keeps complete commands inside the board workspace`, async ({
    page,
  }) => {
    await openGame(page, sample.story, 1440);
    const panel = sample.story.includes('quoridor')
      ? page.getByTestId('custom-game-board-tools')
      : page.locator('[data-component="WordTileActions"]');
    await expect(panel).toHaveCount(1);
    if (sample.story.includes('word-tiles'))
      await page.getByTestId('custom-game-board-more').click();
    for (const name of sample.commands)
      await expect(
        panel.getByRole('button', { name, exact: true })
      ).toBeVisible();
    expect(await containedItems(panel, 'button')).toEqual([]);
  });
}

// regression: word-tiles-compact-bonus-labels-hidden
test('storybook integration: compact Word Tiles bonuses remain readable without color', async ({
  page,
}) => {
  await openGame(page, 'screens-games-word-tiles-board--opening', 390);
  const board = page.locator('[data-component="WordTileBoard"]');
  await expect(board).toBeVisible();
  for (const label of ['2L', '3L', '2W', '3W', '★']) {
    const labels = board.getByText(label, { exact: true });
    expect(await labels.count()).toBeGreaterThan(0);
    const unreadable = await labels.evaluateAll((elements) =>
      elements
        .map((element) => ({
          label: element.textContent,
          visible: element.checkVisibility(),
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        }))
        .filter((label) => !label.visible || label.fontSize < 12)
    );
    expect(unreadable).toEqual([]);
  }
});

for (const width of [390, 1440]) {
  // regression: light-cycles-finished-steering-instructions
  test(`storybook integration: finished Light Cycles offers next steps without steering advice at ${width}`, async ({
    page,
  }) => {
    await openGame(page, 'screens-games-light-cycles-arena--finished', width);
    await expect(
      page.getByRole('heading', { name: 'jordan_plays wins', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Rematch', exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('Swipe the arena or use the pad to steer.', {
        exact: false,
      })
    ).not.toBeVisible();
    await expect(
      page.getByText('Steer with the arrow keys or W, A, S and D.', {
        exact: false,
      })
    ).not.toBeVisible();
  });
}

// regression: desktop-game-record-command-clipping
test('storybook integration: literal Quoridor wall tools fit their board workspace', async ({
  page,
}) => {
  await openGame(page, 'screens-games-quoridor-hill--opening', 1440);
  const tools = page.getByTestId('custom-game-board-tools');
  for (const name of ['Move pawn', 'Horizontal wall', 'Vertical wall'])
    await expect(
      tools.getByRole('button', { name, exact: true })
    ).toBeVisible();
  expect(await containedItems(tools, 'button')).toEqual([]);
});

// regression: light-cycles-finished-steering-instructions
test('storybook integration: literal finished Light Cycles keeps next steps without steering', async ({
  page,
}) => {
  await openGame(page, 'screens-games-light-cycles-arena--finished', 390);
  await expect(
    page.getByRole('heading', { name: 'jordan_plays wins', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Rematch', exact: true })
  ).toBeVisible();
  await expect(
    page.getByText('Swipe the arena or use the pad to steer.', { exact: false })
  ).not.toBeVisible();
  await expect(
    page.getByText('Steer with the arrow keys or W, A, S and D.', {
      exact: false,
    })
  ).not.toBeVisible();
});

// regression: chrome-breadcrumb-current-place-clipped
test('storybook integration: social chrome narrow breadcrumb preserves the current place', async ({
  page,
}) => {
  await openGame(page, 'components-navigation-chromebreadcrumb--states', 390);
  const trail = page.getByRole('navigation', { name: 'Breadcrumb' }).last();
  await expect(
    trail.getByRole('link', {
      name: 'The extremely long and very descriptive name of a space about board games',
    })
  ).toBeVisible();
  await expect(trail.getByText('Connect Four', { exact: true })).toBeVisible();
  expect(await containedItems(trail, '[aria-current="page"]')).toEqual([]);
});

// Edge-aligned status words must fit as actual glyph ranges, not just boxes.
test('storybook integration: social chrome narrow steps keep status words inside the track', async ({
  page,
}) => {
  await openGame(page, 'components-inputs-steptrack--states', 390);
  const tracks = page.locator('[data-component="StepTrack"]');
  await expect(tracks).toHaveCount(2);
  expect(await containedItems(tracks, 'li > *')).toEqual([]);
  const overflow = await tracks.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= 0 &&
        bounds.right <= document.documentElement.clientWidth
        ? []
        : [
            {
              left: bounds.left,
              right: bounds.right,
              viewport: document.documentElement.clientWidth,
            },
          ];
    })
  );
  expect(overflow).toEqual([]);
  const clippedWords = await tracks.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const words: {
        text: string | null;
        right: number;
        viewport: number;
      }[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        for (const rect of range.getClientRects()) {
          if (
            rect.right > document.documentElement.clientWidth ||
            rect.left < 0
          )
            words.push({
              text: walker.currentNode.textContent,
              right: rect.right,
              viewport: document.documentElement.clientWidth,
            });
        }
      }
      return words;
    })
  );
  expect(clippedWords).toEqual([]);
});
