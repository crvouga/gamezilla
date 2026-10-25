import { shippedEditions } from '@libs/game-puzzle-harness-ts/content-game-reads';
import { mountContentExample } from '@libs/game-puzzle-harness-ts/mount-content-example';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { completeOnScreen } from './sokoban-play';
import {
  clickWhenReady,
  closePlay,
  devicePlay,
  screensOf,
  type View,
  waitFor,
} from './sokoban-screen';
import type { SokobanHarness } from './sokoban-system';

/** The starter pack's editions as this run's rules ship them, in pack order. */
export function starterEditions(s: SokobanHarness) {
  const shipped = shippedEditions(s);
  const pack = shipped.revisions.find((edition) => edition.kind === 'pack');
  if (pack === undefined) throw new Error('Sokoban ships no starter pack');
  return {
    pack,
    puzzles: shipped.revisions.filter((edition) => edition.kind === 'puzzle'),
  };
}

async function openStarterPack(
  s: SokobanHarness,
  clientId: string
): Promise<View> {
  closePlay(s, clientId);
  const view = await mountContentExample(s, clientId);
  await clickWhenReady(
    s,
    view,
    `content-bundled-${starterEditions(s).pack.document_id}`
  );
  await waitFor(s, () => view.queryByTestId('content-pack-puzzles') !== null);
  return view;
}

/** From an edition screen: continue its saved attempt, or start one. */
async function enterAttempt(
  s: SokobanHarness,
  clientId: string,
  view: View
): Promise<void> {
  await waitFor(
    s,
    () =>
      view.queryByTestId('content-continue-attempt') !== null ||
      view.queryByTestId('content-start-attempt')?.hasAttribute('disabled') ===
        false
  );
  if (view.queryByTestId('content-continue-attempt') === null)
    fireEvent.click(view.getByTestId('content-start-attempt'));
  await clickWhenReady(s, view, 'content-continue-attempt');
  await waitFor(s, () => view.queryByTestId('sokoban-board') !== null);
  const attemptId = view
    .getByTestId('content-attempt')
    .getAttribute('data-attemptid');
  if (attemptId === null)
    throw new Error('The attempt screen names no attempt');
  screensOf(s, clientId).play = { view, attemptId };
  s.playSelections.set(clientId, { attemptId, positionId: '' });
}

async function startStarter(
  s: SokobanHarness,
  clientId: string,
  index: number
): Promise<void> {
  const view = await openStarterPack(s, clientId);
  const puzzle = starterEditions(s).puzzles[index];
  if (puzzle === undefined) throw new Error(`No starter puzzle ${index}`);
  fireEvent.click(view.getByTestId(`content-pack-puzzle-${puzzle.id}`));
  await enterAttempt(s, clientId, view);
}

export const startStarterPuzzle = defineAction({
  name: 'startStarterPuzzle',
  act: startStarter,
});

/** Continuing offers the pack's next unfinished puzzle, or nothing when complete. */
export const continueStarterPack = defineAction({
  name: 'continueStarterPack',
  act: async (s: SokobanHarness, clientId: string) => {
    const view = await openStarterPack(s, clientId);
    const next = view.queryByTestId('content-pack-next');
    screensOf(s, clientId).told = next === null ? 'no-unfinished-puzzle' : null;
    if (next === null) return;
    fireEvent.click(next);
    await enterAttempt(s, clientId, view);
  },
});

export const completeStarterPuzzle = defineAction({
  name: 'completeStarterPuzzle',
  act: async (s: SokobanHarness, clientId: string, index: number) => {
    await startStarter(s, clientId, index);
    await completeOnScreen(s, clientId);
  },
});

/** Which starter puzzle the open attempt plays, by pack position. */
export async function playingStarter(
  s: SokobanHarness,
  clientId: string
): Promise<number> {
  const attemptId = screensOf(s, clientId).play?.attemptId;
  const attempt = (await devicePlay(s, clientId)).attempts.find(
    (entry) => entry.id === attemptId
  );
  return starterEditions(s).puzzles.findIndex(
    (puzzle) => puzzle.id === attempt?.source_id
  );
}

/** The next puzzle the finished attempt offers, by pack position, or -1. */
export function offeredStarter(s: SokobanHarness, clientId: string): number {
  const view = screensOf(s, clientId).play?.view;
  const offer = view?.queryByTestId('content-next-puzzle')?.textContent ?? '';
  return starterEditions(s).puzzles.findIndex(
    (puzzle) => offer === `Next puzzle: ${puzzle.title}`
  );
}

export async function completedStarters(
  s: SokobanHarness,
  clientId: string
): Promise<ReadonlySet<number>> {
  const done = new Set(
    (await devicePlay(s, clientId)).completions.map(
      (entry) => entry.puzzle_revision_id
    )
  );
  const indices = starterEditions(s).puzzles.flatMap((puzzle, index) =>
    done.has(puzzle.id) ? [index] : []
  );
  return new Set(indices);
}

export const SOKOBAN_STARTER_ACTIONS = [
  startStarterPuzzle,
  continueStarterPack,
  completeStarterPuzzle,
] as const;
