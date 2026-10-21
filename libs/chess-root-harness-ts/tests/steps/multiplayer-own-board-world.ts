import { expect } from 'bun:test';
import type { ShownMultiplayerBoard } from '@libs/chess-root-harness-ts/chess-multiplayer-board';
import { shownMultiplayerBoard } from '@libs/chess-root-harness-ts/chess-multiplayer-board';
import { CHESS_GAME_ID } from '@libs/chess-root-harness-ts/chess-playable';
import {
  bothBoards,
  viewerOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';

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
  await w.s.apply(openFindingAnOpponent, actor, CHESS_GAME_ID);
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
