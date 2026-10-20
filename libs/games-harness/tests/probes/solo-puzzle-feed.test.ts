import { expect, test } from 'bun:test';
import {
  closePuzzleFeedSettingsNoWait,
  includePlayedPuzzles,
  openPuzzleFeedSettings,
  readFeedHistoryLabel,
  setPuzzleFeedTheme,
} from '@libs/game-session-harness/puzzle-feed';
import { writeKnownPuzzlePool } from '@libs/game-session-harness/puzzle-pool';
import {
  isEmptyFeedShown,
  openGamePuzzles,
  readPuzzleOnBoard,
} from '@libs/game-session-harness/puzzle-screen';
import { returnToTabs, signInWithGoogle } from '@libs/harness/auth-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { matchStep } from '@pkgs/gherkin-shared/registry';
import { openConformanceHarness } from '../conformance-world';
import '../steps/puzzle-feed.steps';
import { SOLO_COUNT_GAME } from './solo-count-game';

// regression: themed-pool-already-current-puzzle
test('the shared themed-pool precondition completes an already served solo puzzle', async () => {
  await using s = await openConformanceHarness('solo-themed-current');
  const id = SOLO_COUNT_GAME.shared.id;
  const puzzle = 'solo-count/two-twos';
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(writeKnownPuzzlePool, id, [{ id: puzzle }]);
  await s.apply(createSpace, 'alice');
  await s.apply(openGamePuzzles, 'alice', id);
  expect(await s.read(readPuzzleOnBoard, 'alice')).toBe(puzzle);
  const world: HarnessWorld = {
    s,
    memo: new Map(),
    calls: [],
    ctx: {
      packageName: '@libs/games-harness',
      featureUri: 'specs/games/puzzle-exhaust.feature',
      featureName: 'A themed feed',
      scenarioName: 'The matching puzzle is already served',
      scenarioLine: 1,
      tags: [],
      testId: 'solo-themed-current',
      variant: { id, label: SOLO_COUNT_GAME.label },
    },
  };
  const step = matchStep(
    "Alice has already played the pool's one puzzle with a theme of the game's known puzzle"
  );
  if (step.kind !== 'match') throw new Error(`Expected one step: ${step.kind}`);
  await step.definition.body(world, ...step.args);
  await s.apply(openPuzzleFeedSettings, 'alice');
  await s.apply(setPuzzleFeedTheme, 'alice', id, 'short');
  await s.apply(closePuzzleFeedSettingsNoWait, 'alice');
  await s.until((surf) => isEmptyFeedShown(surf, 'alice'), { maxMs: 20_000 });
  await s.apply(includePlayedPuzzles, 'alice');
  expect(await s.read(readFeedHistoryLabel, 'alice')).toBe('Any');
  expect(await s.read(readPuzzleOnBoard, 'alice')).not.toBeNull();
}, 120_000);
