/**
 * Every game's puzzle board (its client's `puzzles.Board`), rendered as the
 * platform's puzzle screens render it, on its known puzzles: the automated
 * participant plays each solution move on it with the game's own gesture
 * (`automation.perform`) and the board reports exactly that move; the board
 * shows a wrong move, a hint and the shown solution (it draws differently
 * with each mark than without); a review board takes no move; and every
 * move of a known line has words in each of the game's notations.
 */

import { afterEach, expect, test } from 'bun:test';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type { SolidDomDriver } from '@pkgs/ui-testing-solid-dom-client-ts/solid-dom-driver';
import { forEveryGame } from '../game-suite';
import type { MountedBoardProps } from './puzzle-board-mount';
import {
  PUZZLE_BOARD as BOARD,
  puzzleBoardDriver,
  UNMARKED,
} from './puzzle-board-mount';
import { puzzleCase } from './puzzle-room';

let mounted: SolidDomDriver | null = null;

afterEach(async () => {
  await mounted?.close();
  mounted = null;
});

/** `game`'s puzzle board mounted alone, reporting its moves to `played`. */
async function mount(
  game: HarnessGame,
  props: MountedBoardProps,
  played: string[] = []
): Promise<SolidDomDriver> {
  await mounted?.close();
  mounted = puzzleBoardDriver(game, props, played);
  await mounted.launch();
  return mounted;
}

/** The board's markup for `props`. */
async function drawn(
  game: HarnessGame,
  props: MountedBoardProps
): Promise<string> {
  return (await (await mount(game, props)).snapshotHtml()) ?? '';
}

forEveryGame(import.meta.path, (game) => {
  const c = puzzleCase(game);
  const { layout } = c;

  test('the automated participant plays each solution move on the puzzle board', async () => {
    for (const fixture of c.known) {
      const trail = c.trail(fixture);
      for (const [index, action] of fixture.solution.entries()) {
        const played: string[] = [];
        const driver = await mount(
          game,
          { position: trail[layout.start + layout.solverStep * index] ?? '' },
          played
        );
        await game.shared.automation.perform(driver, BOARD, action);
        expect({ id: fixture.record.id, played }).toEqual({
          id: fixture.record.id,
          played: [action],
        });
      }
    }
  });

  test('the board shows a wrong move, a hint and the shown solution', async () => {
    const fixture = c.long;
    const position = c.trail(fixture)[layout.start] ?? '';
    const solution = c.puzzles.marks(position, fixture.solution[0] ?? '');
    if (solution === null) throw new Error('the solution move names no cells');
    const plain = await drawn(game, { position });
    for (const marks of [
      { ...UNMARKED, wrong: solution.to },
      { ...UNMARKED, hint: solution.from ?? solution.to },
      { ...UNMARKED, solution },
    ])
      expect({
        marks,
        same: (await drawn(game, { position, marks })) === plain,
      }).toEqual({
        marks,
        same: false,
      });
  });

  test('a review board takes no move', async () => {
    const fixture = c.long;
    const played: string[] = [];
    const driver = await mount(
      game,
      {
        position: c.trail(fixture)[layout.start] ?? '',
        mode: 'review',
        interactive: false,
      },
      played
    );
    await game.shared.automation
      .perform(driver, BOARD, fixture.solution[0] ?? '')
      .catch(() => undefined);
    expect(played).toEqual([]);
  });

  test('every move of a known line has words in each of its notations', () => {
    const notation = game.client.puzzles?.notation;
    for (const fixture of c.known)
      for (const label of fixture.labels) {
        expect(label.trim()).not.toBe('');
        for (const choice of notation?.choices ?? [])
          expect(notation?.format(label, choice).trim()).not.toBe('');
      }
  });
});
