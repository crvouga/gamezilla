import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  arrangePublishedSokoban,
  startAttemptByMutation,
} from './sokoban-fixtures';
import { playedPosition, shownPlay } from './sokoban-play';
import { devicePlay, openAttemptOnScreen } from './sokoban-screen';
import type { SokobanHarness } from './sokoban-system';

const BOB = 'bob:phone';
/** A1 wall, B1–D1 floor, E1 and F1 goals, G1 outside; the worker on B1. */
const STARTS = {
  first: JSON.stringify({ format: 1, rows: ['#@$ .*~'] }),
  second: JSON.stringify({ format: 1, rows: ['#@  **~'] }),
} as const;
const EDITION = new WeakMap<SokobanHarness, string>();

export const setupSokobanPlay = defineAction({
  name: 'setupSokobanPlay',
  act: async (s: SokobanHarness, start: keyof typeof STARTS) => {
    const revisionId = await arrangePublishedSokoban(s, {
      title: 'Row',
      definition: STARTS[start],
    });
    EDITION.set(s, revisionId);
    const attemptId = await startAttemptByMutation(s, BOB, {
      revisionId,
      packRevisionId: null,
    });
    await openAttemptOnScreen(s, BOB, attemptId);
  },
});

/** The sokoban-play model numbers the row's squares 0 (A1) to 6 (G1). */
export async function sokobanPlayState(s: SokobanHarness) {
  const played = await playedPosition(s, BOB);
  if (played === null) throw new Error('Bob is not playing the row');
  const shown = shownPlay(s, BOB);
  const completions = (await devicePlay(s, BOB)).completions.filter(
    (entry) => entry.puzzle_revision_id === EDITION.get(s)
  ).length;
  return {
    worker: played.position.worker.x,
    crates: new Set(played.position.crates.map((crate) => crate.x)),
    moves: shown.moves,
    pushes: shown.pushes,
    complete: shown.complete,
    completions,
  };
}

export const SOKOBAN_PLAY_MODEL_ACTIONS = [setupSokobanPlay] as const;
