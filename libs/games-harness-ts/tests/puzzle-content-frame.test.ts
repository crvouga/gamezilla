/**
 * Every game with authored puzzles labels each figure its content counts
 * (`statistics`), so the solo frame never shows a figure without a name,
 * and its status line is words or nothing — at every step of every puzzle
 * it ships, played through its known solution.
 */

import { expect, test } from 'bun:test';
import type { PuzzleContentFrame } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
import type {
  BundledPuzzle,
  PuzzleContent,
} from '@pkgs/turn-game-shared-ts/puzzle-content';

/** Each state of `puzzle` from its start through its known solution. */
function solutionStates(
  content: PuzzleContent,
  puzzle: BundledPuzzle
): readonly string[] {
  const start = content.rules.initial(puzzle.definition);
  if (!start.accepted) return [];
  const states = [start.state];
  for (const action of puzzle.witness) {
    const change = content.rules.apply(
      puzzle.definition,
      states.at(-1)!,
      action
    );
    if (!change.accepted) break;
    states.push(change.state);
  }
  return states;
}

/** What the solo frame says of `puzzle` at each step that is not words. */
function unlabelled(
  content: PuzzleContent,
  frame: PuzzleContentFrame,
  puzzle: BundledPuzzle
): readonly string[] {
  return solutionStates(content, puzzle).flatMap((state) => {
    const figures = Object.keys(
      content.statistics?.(puzzle.definition, state) ?? {}
    );
    const status = frame.turnStatus(puzzle.definition, state);
    return [
      ...figures.filter(
        (figure) => (frame.stats[figure]?.() ?? '').trim() === ''
      ),
      ...(status !== null && status.trim() === '' ? ['status'] : []),
    ].map((what) => `${puzzle.id}: ${what}`);
  });
}

test('the solo frame names every figure and status of every shipped puzzle', async () => {
  const { GAME_CLIENT_DEFINITIONS } = await import(
    '@libs/games-client-ts/game-plugins.client'
  );
  const checked: string[] = [];
  for (const definition of GAME_DEFINITIONS) {
    const content = definition.puzzleContent;
    const frame = GAME_CLIENT_DEFINITIONS.find(
      (client) => client.id === definition.id
    )?.puzzleContent?.frame;
    if (content === undefined || frame === undefined) continue;
    const puzzles = [
      ...(content.bundledPacks ?? []),
      ...(content.starter === undefined ? [] : [content.starter]),
    ].flatMap((pack) => pack.puzzles);
    expect({
      game: definition.id,
      unlabelled: puzzles.flatMap((puzzle) =>
        unlabelled(content, frame, puzzle)
      ),
    }).toEqual({ game: definition.id, unlabelled: [] });
    if (puzzles.length > 0) checked.push(definition.id);
  }
  expect(checked.length).toBeGreaterThan(0);
});
