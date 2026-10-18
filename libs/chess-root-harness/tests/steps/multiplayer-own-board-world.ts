import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import type { ShownMultiplayerBoard } from '@libs/chess-matchmaking-harness/multiplayer-own-board';
import { shownMultiplayerBoard } from '@libs/chess-matchmaking-harness/multiplayer-own-board';
import {
  bothBoards,
  viewerOf,
} from '@libs/game-matchmaking-harness/matched-game-world';
import type { HarnessWorld } from '@libs/harness/spec-world';

/**
 * The person's screen comes to show the two people's current multiplayer
 * game with its board as named, and what it shows then.
 */
export async function ownBoardSeen(
  w: HarnessWorld,
  person: string,
  expected: {
    readonly [K in keyof ShownMultiplayerBoard]?:
      | ShownMultiplayerBoard[K]
      | undefined;
  }
): Promise<ShownMultiplayerBoard> {
  const actor = viewerOf(w, person);
  const named = Object.entries(expected).filter(
    ([, value]) => value !== undefined
  );
  const wanted = {
    ...Object.fromEntries(named),
    gameId: (await bothBoards(w)).id,
  };
  await w.s.apply(openMultiplayerChess, actor, wanted.gameId);
  await w.s.until((s) => shownMultiplayerBoard(s, actor), {
    pred: (shown) =>
      Object.entries(wanted).every(
        ([key, value]) => shown[key as keyof ShownMultiplayerBoard] === value
      ),
  });
  const shown = await w.s.read(shownMultiplayerBoard, actor);
  expect(shown).toMatchObject(wanted);
  return shown;
}

/** How the screen names each of those moves by itself. */
export const MOVE_NAMED: Readonly<Record<string, string>> = {
  e4: '1. e4',
  e5: '1... e5',
  Nf3: '2. Nf3',
};
