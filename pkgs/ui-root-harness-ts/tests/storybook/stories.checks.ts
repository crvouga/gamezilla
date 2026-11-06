// @io-wall-ok — browser verification adapter; all requests stay on the static server
import { readFileSync } from 'node:fs';
import { type Page, test } from '@playwright/test';
import { visualScenarios } from '../../storybook/scenarios';
import { verifySharedSwipeCapture } from './light-cycles-pointer';
import { verifyStoryScenario } from './verify-story-scenario';

type Entry = { id: string; type: string; importPath: string };
const index = JSON.parse(
  readFileSync(
    new URL('../../.cache/storybook/index.json', import.meta.url),
    'utf8'
  )
) as { entries: Record<string, Entry> };
for (const story of Object.values(index.entries).filter(
  (e) => e.type === 'story'
)) {
  for (const scenario of visualScenarios(story)) {
    // This exact matrix entry is registered literally below.
    if (
      story.id === 'primitives-sparkline--states' &&
      scenario.theme === 'dark' &&
      scenario.width === 390
    )
      continue;
    const { theme, suffix } = scenario;
    test(`${story.id} ${theme}${suffix}`, async ({ page }) => {
      await verifyStoryScenario(page, story.id, scenario);
    });
  }
}

// regression: storybook-ubuntu-renderer-baselines
test('primitives-sparkline--states dark', async ({ page }) => {
  const story = index.entries['primitives-sparkline--states'];
  if (!story) throw new Error('Missing Sparkline states story');
  const scenario = visualScenarios(story).find(
    (candidate) => candidate.theme === 'dark' && candidate.width === 390
  );
  if (!scenario) throw new Error('Missing Sparkline dark 390px scenario');
  await verifyStoryScenario(page, 'primitives-sparkline--states', scenario);
});

async function verifyBoardRegression(
  page: Page,
  id: string,
  width: number,
  theme = 'light'
) {
  const story = index.entries[id];
  if (!story) throw new Error(`Missing regression story: ${id}`);
  const scenario = visualScenarios(story).find(
    (item) => item.theme === theme && item.width === width
  );
  if (!scenario) throw new Error(`Missing regression viewport: ${width}`);
  await verifyStoryScenario(page, id, scenario);
}

// regression: quoridor-pawn-prominence-and-identity
test('screens-games-quoridor-classic--pawn-identity-and-keyboard regression quoridor-pawn-prominence-and-identity', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-quoridor-classic--pawn-identity-and-keyboard',
    390
  );
});

// regression: sokoban-desktop-blocked-move-pad
test('screens-games-sokoban-puzzle--blocked-move regression sokoban-desktop-blocked-move-pad', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-sokoban-puzzle--blocked-move',
    1440
  );
});

// regression: numberlink-solved-keeps-drawing-hints
test('screens-games-numberlink-puzzle--complete-with-keyboard regression numberlink-solved-keeps-drawing-hints', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-numberlink-puzzle--complete-with-keyboard',
    390
  );
});

// regression: light-cycles-player-facts-overflow
test('screens-games-light-cycles-arena--crashed regression light-cycles-player-facts-overflow', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-light-cycles-arena--crashed',
    390
  );
});

// regression: light-cycles-inactive-steering-guidance
test('screens-games-light-cycles-arena--reconnecting regression light-cycles-inactive-steering-guidance', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-light-cycles-arena--reconnecting',
    390
  );
});

// regression: hearts-phone-side-name-fragments
test('screens-games-hearts-board--cards-on-their-way regression hearts-phone-side-name-fragments', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-hearts-board--cards-on-their-way',
    390
  );
});

// regression: light-cycles-desktop-steer-up
test('screens-games-light-cycles-arena--steer-up regression desktop', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-light-cycles-arena--steer-up',
    1440
  );
});

// regression: battleship-dark-grid-boundaries
test('games-cellgridboard-boundary-contrast--open-water regression battleship-dark-grid-boundaries', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'games-cellgridboard-boundary-contrast--open-water',
    390,
    'dark'
  );
});

// regression: battleship-victory-hides-enemy-fleet
test('screens-games-battleship-board--won regression battleship-victory-hides-enemy-fleet', async ({
  page,
}) => {
  await verifyBoardRegression(page, 'screens-games-battleship-board--won', 390);
});

// regression: quoridor-hill-forced-pass-clipped
test('screens-games-quoridor-hill--pass-and-continue regression quoridor-hill-forced-pass-clipped', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-quoridor-hill--pass-and-continue',
    390
  );
});

// regression: quoridor-intrinsic-action-clipping
test('screens-games-quoridor-classic--opening regression quoridor-intrinsic-action-clipping', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-quoridor-classic--opening',
    390
  );
});

// regression: sokoban-history-corner-recovery
test('screens-games-sokoban-puzzle--corner-recovery regression sokoban-history-corner-recovery', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-sokoban-puzzle--corner-recovery',
    390
  );
});

// regression: sokoban-zero-moves-undo-guidance
test('screens-games-sokoban-puzzle--blocked-move regression sokoban-zero-moves-undo-guidance', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-sokoban-puzzle--blocked-move',
    390
  );
});

// regression: word-tiles-puzzle-completion-remains-editable
test('screens-games-word-tiles-puzzle--reach-target regression word-tiles-puzzle-completion-remains-editable', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-puzzle--reach-target',
    390
  );
});

// regression: word-tiles-puzzle-retry-keeps-draft
test('screens-games-word-tiles-puzzle--reach-target regression word-tiles-puzzle-retry-keeps-draft', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-puzzle--reach-target',
    390
  );
});

// regression: word-tiles-retry-retained-accepted-draft
test('screens-games-word-tiles-board--recover-and-submit regression word-tiles-retry-retained-accepted-draft', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-board--recover-and-submit',
    390
  );
});

// regression: numberlink-phone-path-recovery-undiscoverable
test('screens-games-numberlink-puzzle--recover-with-pointer regression numberlink-phone-path-recovery-undiscoverable', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-numberlink-puzzle--recover-with-pointer',
    390
  );
});

// regression: word-tiles-local-lexicon-retry-misstates-play
test('screens-games-word-tiles-board--recover-and-submit regression word-tiles-local-lexicon-retry-misstates-play', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-board--recover-and-submit',
    390
  );
});

// regression: light-cycles-synthetic-swipe-native-capture
test('screens-games-light-cycles-arena--shared-swipe regression light-cycles-synthetic-swipe-native-capture', async ({
  page,
}) => {
  await verifySharedSwipeCapture(page);
  await verifyBoardRegression(
    page,
    'screens-games-light-cycles-arena--shared-swipe',
    390
  );
});

// regression: word-tiles-score-assertion-matches-coordinates
test('screens-games-word-tiles-board--recover-and-submit regression word-tiles-score-assertion-matches-coordinates', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-board--recover-and-submit',
    390
  );
});

// regression: battleship-enlargement-below-fold
test('screens-games-battleship-setup--enlarged-placement regression battleship-enlargement-below-fold', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-setup--enlarged-placement',
    390
  );
});

// regression: chess-puzzle-guidance-clips-first-rank
test('screens-puzzles-chess-play--solving regression chess-puzzle-guidance-clips-first-rank', async ({
  page,
}) => {
  await verifyBoardRegression(page, 'screens-puzzles-chess-play--solving', 390);
});

// regression: battleship-bounded-targets-under-touch-size
test('screens-games-battleship-setup--enlarged-placement regression battleship-bounded-targets-under-touch-size', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-setup--enlarged-placement',
    390
  );
});

// regression: chess-puzzle-bounds-includes-square-layout
test('screens-puzzles-chess-play--solving regression chess-puzzle-bounds-includes-square-layout', async ({
  page,
}) => {
  await verifyBoardRegression(page, 'screens-puzzles-chess-play--solving', 390);
});
