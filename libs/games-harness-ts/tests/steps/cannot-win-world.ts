/**
 * A game where the second side cannot win: the game's known line to such a
 * position (`secondSideCannotWin`), short of its last move, so the first
 * side is to move. Only games whose fixtures name such a line run the
 * scenarios that need it (`SHARED_SPECIFICATIONS`: a side that cannot win).
 */

import { givenMultiplayerClock } from '@libs/game-matchmaking-harness-ts/matched-game-fixtures';
import {
  acceptedMoves,
  bothBoards,
  matchedGameOf,
  pairOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { gameOf } from './game-world';
import { pairedAt } from './matched-game';

/** The game's known line to a position where the second side cannot win. */
export function cannotWinLine(w: HarnessWorld): readonly string[] {
  const line = gameOf(w).fixtures.secondSideCannotWin;
  if (line === undefined)
    throw new Error(
      `${gameOf(w).label} names no position its second side cannot win`
    );
  return line;
}

/** A matched game at `clock` played along the line, the first side to move. */
export async function cannotWinMatchedGame(
  w: HarnessWorld,
  people: readonly [string, string],
  clock: string
): Promise<void> {
  await pairedAt(w, people[0], people[1], clock);
  await acceptedMoves(w, cannotWinLine(w).slice(0, -1));
}

/**
 * `side` of the matched game to move with `ms` left. The second side's
 * clock runs once the first side makes the line's last move, which leaves
 * the second side still unable to win.
 */
export async function matchedTimeLeft(
  w: HarnessWorld,
  side: CustomGameSide,
  ms: number
): Promise<void> {
  if (side === 'black') await acceptedMoves(w, [cannotWinLine(w).at(-1)!]);
  const game = await matchedGameOf(w, pairOf(w)[0]);
  await w.s.apply(givenMultiplayerClock, pairOf(w)[0], {
    gameId: game.id,
    side,
    ms,
  });
  await bothBoards(
    w,
    (g) => (side === 'white' ? g.white_ms : g.black_ms) === ms
  );
}
