import { test } from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';

// regression: hearts-trick-card-double-pip
test('screens-games-hearts-board--your-turn-to-play regression hearts-trick-card-double-pip', async ({
  page,
}) => {
  await verifyStoryScenario(
    page,
    'screens-games-hearts-board--your-turn-to-play',
    { width: 1280, height: 800, theme: 'light', globals: {}, suffix: '' }
  );
});

// regression: hearts-unavailable-cards-louder-than-legal
test('screens-games-hearts-board--your-turn-to-play regression hearts-unavailable-cards-louder-than-legal', async ({
  page,
}) => {
  await verifyStoryScenario(
    page,
    'screens-games-hearts-board--your-turn-to-play',
    { width: 390, height: 844, theme: 'light', globals: {}, suffix: '' }
  );
});

// regression: space-join-badge-above-title
test('screens-space-join--live regression space-join-badge-above-title', async ({
  page,
}) => {
  await verifyStoryScenario(page, 'screens-space-join--live', {
    width: 390,
    height: 844,
    theme: 'light',
    globals: {},
    suffix: '',
  });
});

// regression: space-recovery-off-center
test('screens-space-ended--long-content regression space-recovery-off-center', async ({
  page,
}) => {
  await verifyStoryScenario(page, 'screens-space-ended--long-content', {
    width: 1280,
    height: 800,
    theme: 'light',
    globals: {},
    suffix: '',
  });
});

// regression: space-share-toast-covers-close
test('screens-spaces-share--added regression space-share-toast-covers-close', async ({
  page,
}) => {
  await verifyStoryScenario(page, 'screens-spaces-share--added', {
    width: 1280,
    height: 800,
    theme: 'light',
    globals: {},
    suffix: '',
  });
});

// regression: word-tiles-enlarged-edge-slivers
test('screens-games-word-tiles-board--four-player-match regression word-tiles-enlarged-edge-slivers', async ({
  page,
}) => {
  await verifyStoryScenario(
    page,
    'screens-games-word-tiles-board--four-player-match',
    { width: 390, height: 844, theme: 'light', globals: {}, suffix: '' }
  );
});

// regression: word-tiles-puzzle-board-offset
test('screens-games-word-tiles-puzzle--reach-target regression word-tiles-puzzle-board-offset', async ({
  page,
}) => {
  await verifyStoryScenario(
    page,
    'screens-games-word-tiles-puzzle--reach-target',
    { width: 1280, height: 800, theme: 'light', globals: {}, suffix: '' }
  );
});

// regression: chess-early-game-side-marks
test('screens-games-chess-board--early-game regression chess-early-game-side-marks', async ({
  page,
}) => {
  await verifyStoryScenario(page, 'screens-games-chess-board--early-game', {
    width: 390,
    height: 844,
    theme: 'light',
    globals: {},
    suffix: '',
  });
});

// regression: quoridor-hill-camera-viewport
test('screens-games-quoridor-hill--four-player-round regression quoridor-hill-camera-viewport', async ({
  page,
}) => {
  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    await verifyStoryScenario(
      page,
      'screens-games-quoridor-hill--four-player-round',
      { width, height, theme: 'light', globals: {}, suffix: '' }
    );
  }
});
