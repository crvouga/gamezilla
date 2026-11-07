// @io-wall-ok — browser verification adapter; all requests stay on the static server
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
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

// regression: battleship-enlarged-targets-shrink-to-toolbar
test('screens-games-battleship-board--correct-target-before-firing regression battleship-enlarged-targets-shrink-to-toolbar', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-board--correct-target-before-firing',
    390
  );
});

// regression: chess-puzzle-story-pointer-target
test('screens-puzzles-chess-play--solving regression chess-puzzle-story-pointer-target', async ({
  page,
}) => {
  await verifyBoardRegression(page, 'screens-puzzles-chess-play--solving', 390);
});

// regression: chess-puzzle-instrumented-bounds-overload
test('storybook integration: instrumented chess geometry screens-puzzles-chess-play--wrong-move-recovery', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    '/iframe.html?id=screens-puzzles-chess-play--wrong-move-recovery&viewMode=story&instrument=true'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await expect(
    page.getByText('Checkmate. Puzzle solved.', { exact: true })
  ).toBeVisible();
  expect(errors).toEqual([]);
});

// regression: quoridor-four-seat-record-split-notation
test('screens-games-quoridor-hill--four-player-round regression quoridor-four-seat-record-split-notation', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-quoridor-hill--four-player-round',
    1440
  );
});

// regression: light-cycles-quad-clipped-identities
test('screens-games-light-cycles-arena--quad-steering regression light-cycles-quad-clipped-identities', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-light-cycles-arena--quad-steering',
    390
  );
});

// regression: quoridor-hill-four-seat-confirm-below-fold
test('screens-games-quoridor-hill--four-player-round regression quoridor-hill-four-seat-confirm-below-fold', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-quoridor-hill--four-player-round',
    390
  );
});

// regression: word-tiles-blank-letter-content-overflow
test('screens-games-word-tiles-board--assign-a-blank regression word-tiles-blank-letter-content-overflow', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-board--assign-a-blank',
    390
  );
});

// regression: word-tiles-blank-chooser-pushes-precision-below-fold
test('screens-games-word-tiles-puzzle--enlarged-blank regression word-tiles-blank-chooser-pushes-precision-below-fold', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-puzzle--enlarged-blank',
    1440
  );
});

// regression: shared-board-four-seat-wrapped-name-height
test('screens-games-frame-geometry--four-players regression shared-board-four-seat-wrapped-name-height', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-frame-geometry--four-players',
    390
  );
});

// regression: battleship-default-precision-loses-whole-field
test('screens-games-battleship-board--correct-target-before-firing regression battleship-default-precision-loses-whole-field', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-board--correct-target-before-firing',
    390
  );
});

// regression: battleship-target-context-below-fold
test('screens-games-battleship-board--your-turn regression battleship-target-context-below-fold', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-board--your-turn',
    390
  );
});

// regression: word-tiles-phone-precision-default
test('screens-games-word-tiles-board--your-turn regression word-tiles-phone-precision-default', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-board--your-turn',
    390
  );
});

// regression: word-tiles-map-fine-target-detour
test('screens-games-word-tiles-puzzle--ready regression word-tiles-map-fine-target-detour', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-puzzle--ready',
    390
  );
});

// regression: word-tiles-blank-direct-letter-entry
test('screens-games-word-tiles-puzzle--enlarged-blank regression word-tiles-blank-direct-letter-entry', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-puzzle--enlarged-blank',
    390
  );
});

// regression: word-tiles-blank-duplicate-instruction
test('screens-games-word-tiles-puzzle--enlarged-blank regression word-tiles-blank-duplicate-instruction', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-puzzle--enlarged-blank',
    390
  );
});

// regression: battleship-phone-placement-default
test('screens-games-battleship-setup--empty regression battleship-phone-placement-default', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-setup--empty',
    390
  );
});

// regression: battleship-placement-overview-legibility
test('screens-games-battleship-setup--enlarged-placement regression battleship-placement-overview-legibility', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-setup--enlarged-placement',
    390
  );
});

// regression: battleship-placement-guidance-gap
test('screens-games-battleship-setup--enlarged-placement regression battleship-placement-guidance-gap', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-setup--enlarged-placement',
    390
  );
});

// regression: word-tiles-precision-local-score-below-fold
test('screens-games-word-tiles-board--your-turn regression word-tiles-precision-local-score-below-fold', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-board--your-turn',
    390
  );
});

// regression: battleship-guidance-check-target
test('screens-games-battleship-setup--empty regression battleship-guidance-check-target', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-setup--empty',
    390
  );
});

// regression: word-tiles-region-composite-hit-target
test('screens-games-word-tiles-board--enlarged-coordinates regression word-tiles-region-composite-hit-target', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-board--enlarged-coordinates',
    390
  );
});

// regression: game-four-player-identity-line-breaks
test('screens-games-light-cycles-arena--quad-steering regression game-four-player-identity-line-breaks', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-light-cycles-arena--quad-steering',
    390
  );
});

// regression: numberlink-story-missing-save-reason
test('screens-games-numberlink-puzzle--disabled regression numberlink-story-missing-save-reason', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-numberlink-puzzle--disabled',
    390
  );
});

// regression: numberlink-story-missing-next-puzzle
test('screens-games-numberlink-puzzle--next-puzzle regression numberlink-story-missing-next-puzzle', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-numberlink-puzzle--next-puzzle',
    390
  );
});

// regression: quoridor-competing-cell-chrome
test('screens-games-quoridor-classic--opening regression quoridor-competing-cell-chrome', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-quoridor-classic--opening',
    390
  );
});

// regression: quoridor-split-wall-editing
test('screens-games-quoridor-classic--rotate-wall-preview regression quoridor-split-wall-editing', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-quoridor-classic--rotate-wall-preview',
    390
  );
});

// regression: quoridor-split-wall-editing
test('screens-games-quoridor-hill--recover-wall-placement regression quoridor-split-wall-editing', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-quoridor-hill--recover-wall-placement',
    390
  );
});

// regression: quoridor-wall-start-wording
test('screens-games-quoridor-classic--precise-coordinates regression quoridor-wall-start-wording', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-quoridor-classic--precise-coordinates',
    390
  );
});

// regression: quoridor-wall-start-wording
test('screens-games-quoridor-hill--precise-coordinates regression quoridor-wall-start-wording', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-quoridor-hill--precise-coordinates',
    390
  );
});

// regression: quoridor-finished-editing-clutter
test('screens-games-quoridor-hill--reach-the-hill regression quoridor-finished-editing-clutter', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-quoridor-hill--reach-the-hill',
    390
  );
});

// regression: quoridor-finished-editing-clutter
test('screens-games-quoridor-classic--reach-opposite-edge regression quoridor-finished-editing-clutter', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-quoridor-classic--reach-opposite-edge',
    390
  );
});

// regression: word-tiles-blank-assignment-context
test('screens-games-word-tiles-board--assign-a-blank 390 regression word-tiles-blank-assignment-context', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-board--assign-a-blank',
    390
  );
});

// regression: word-tiles-blank-assignment-context
test('screens-games-word-tiles-board--assign-a-blank 1440 regression word-tiles-blank-assignment-context', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-board--assign-a-blank',
    1440
  );
});

// regression: word-tiles-blank-assignment-context
test('screens-games-word-tiles-puzzle--enlarged-blank 390 regression word-tiles-blank-assignment-context', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-puzzle--enlarged-blank',
    390
  );
});

// regression: word-tiles-blank-assignment-context
test('screens-games-word-tiles-puzzle--enlarged-blank 1440 regression word-tiles-blank-assignment-context', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-puzzle--enlarged-blank',
    1440
  );
});

// regression: word-tiles-region-purpose-hidden
test('screens-games-word-tiles-board--enlarged-coordinates 390 regression word-tiles-region-purpose-hidden', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-board--enlarged-coordinates',
    390
  );
});

// regression: word-tiles-puzzle-preview-shortfall
test('screens-games-word-tiles-puzzle--enlarged-blank 390 regression word-tiles-puzzle-preview-shortfall', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-word-tiles-puzzle--enlarged-blank',
    390
  );
});

// regression: battleship-round8-spatial-placement
test('screens-games-battleship-setup--spatial-region-selection 390 regression battleship-round8-spatial-placement', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-setup--spatial-region-selection',
    390
  );
});

// regression: battleship-round8-spatial-placement
test('screens-games-battleship-setup--spatial-region-selection 1440 regression battleship-round8-spatial-placement', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-setup--spatial-region-selection',
    1440
  );
});

// regression: battleship-round8-spatial-target-context
test('screens-games-battleship-board--correct-target-before-firing 390 regression battleship-round8-spatial-target-context', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-board--correct-target-before-firing',
    390
  );
});

// regression: battleship-round8-spatial-target-context
test('screens-games-battleship-board--correct-target-before-firing 1440 regression battleship-round8-spatial-target-context', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-battleship-board--correct-target-before-firing',
    1440
  );
});

// regression: light-cycles-steer-up-wide-story
test('screens-games-light-cycles-arena--steer-up regression light-cycles-steer-up-wide-story', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-light-cycles-arena--steer-up',
    1440
  );
});

// regression: sokoban-blocked-move-wide-story
test('screens-games-sokoban-puzzle--blocked-move regression sokoban-blocked-move-wide-story', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-sokoban-puzzle--blocked-move',
    1440
  );
});

// regression: solved-pack-story-completion
test('screens-games-numberlink-puzzle--solved regression solved-pack-story-completion', async ({
  page,
}) => {
  await verifyBoardRegression(
    page,
    'screens-games-numberlink-puzzle--solved',
    1440
  );
  await verifyBoardRegression(
    page,
    'screens-games-sokoban-puzzle--solved',
    1440
  );
});

// regression: space-detail-fixture-roster-disagrees
test('screens-spaces-detail--nobody-else regression space-detail-fixture-roster-disagrees', async ({
  page,
}) => {
  await verifyBoardRegression(page, 'screens-spaces-detail--nobody-else', 1440);
  await verifyBoardRegression(
    page,
    'screens-spaces-detail--members-open',
    1440
  );
});
