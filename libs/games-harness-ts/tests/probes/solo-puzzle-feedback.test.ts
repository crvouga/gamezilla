import { expect, test } from 'bun:test';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import { playNextKnownMove } from '@libs/game-session-harness-ts/puzzle-moves';
import { writeKnownPuzzlePool } from '@libs/game-session-harness-ts/puzzle-pool';
import {
  openGamePuzzles,
  readPuzzleProbe,
} from '@libs/game-session-harness-ts/puzzle-screen';
import {
  puzzleContinuationSounds,
  readPuzzleSoundsPlayed,
} from '@libs/game-session-harness-ts/puzzle-sounds';
import { returnToTabs, signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { configureSounds } from '@libs/harness-ts/sounds-preference';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import { COUNTING_RACE_GAME } from '../reference-game/counting-race-game';
import { SOLO_COUNT_GAME } from './solo-count-game';

const SYSTEM = gameSystem('solo-feedback', [SOLO_COUNT_GAME], {
  knownPuzzles: true,
});

// regression: solver-only-hearing-requires-reply
test('a solo continuation has one movement sound and an opponent continuation has two', () => {
  expect(puzzleContinuationSounds(SOLO_COUNT_GAME)).toEqual([
    'correct move',
    'move',
  ]);
  expect(puzzleContinuationSounds(COUNTING_RACE_GAME)).toEqual([
    'correct move',
    'move',
    'move',
  ]);
});

// regression: solver-only-first-correct-feedback
test('the first solo action from zero advances once and plays its correct-move cue', async () => {
  await using s = await openGameHarness(SYSTEM, 'solo-first-feedback');
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(configureSounds, 'alice', true);
  await s.apply(writeKnownPuzzlePool, SOLO_COUNT_GAME.shared.id, [
    { id: 'solo-count/two-twos' },
  ]);
  await s.apply(createSpace, 'alice');
  await s.apply(openGamePuzzles, 'alice', SOLO_COUNT_GAME.shared.id);
  expect((await s.read(readPuzzleProbe, 'alice'))?.solveIdx).toBe(0);
  const before = (
    await s.read(readPuzzleSoundsPlayed, 'alice', SOLO_COUNT_GAME.shared.id)
  ).length;
  await s.apply(playNextKnownMove, 'alice', SOLO_COUNT_GAME.shared.id);
  await s.advanceTime(1_000);
  expect((await s.read(readPuzzleProbe, 'alice'))?.solveIdx).toBe(1);
  const sounds = await s.read(
    readPuzzleSoundsPlayed,
    'alice',
    SOLO_COUNT_GAME.shared.id
  );
  expect([...sounds.slice(before)].sort()).toEqual(['correct move', 'move']);
}, 120_000);
