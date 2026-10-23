/**
 * Chess's matched games: the shared matched-game world
 * (`@libs/game-matchmaking-harness-ts/matched-game-world`) with chess's own
 * people, its time controls and its moves.
 */

import { playMultiplayerMove } from '@libs/chess-root-harness-ts/chess-multiplayer-board';
import {
  acceptedMoves,
  matchedGameOf,
  pairMatchedGame,
  rememberBoardBeforeMove,
  resignedBySecond,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { multiplayerPeople } from './multiplayer-people';

/** A new game with the named colours: both searched at one time control, then paired. */
export function givenGame(
  w: HarnessWorld,
  white = 'alice',
  black = 'bob',
  timeControl = '5+0'
) {
  return pairMatchedGame(w, {
    people: multiplayerPeople,
    first: white,
    second: black,
    timeControl,
  });
}

/**
 * The person plays a move on the board their device shows: while they
 * review an earlier position that board is all their hand can reach.
 */
export async function playOnOwnBoard(
  w: HarnessWorld,
  actor: string,
  uci: string
) {
  const game = await matchedGameOf(w, actor);
  rememberBoardBeforeMove(w, game);
  await w.s.apply(playMultiplayerMove, actor, {
    gameId: game.id,
    revision: game.revision,
    uci,
    requestId: `move-${game.id}-${actor}-${String(game.revision)}-${uci}`,
  });
}

/** A game in which both people have made their first move (e4 and e5). */
export async function givenBegunGame(
  w: HarnessWorld,
  white = 'alice',
  black = 'bob',
  timeControl = '5+0'
) {
  await givenGame(w, white, black, timeControl);
  await acceptedMoves(w, ['e2e4', 'e7e5']);
}

/** A finished game: both moved, then Black resigned, so White won. */
export async function givenOverGame(
  w: HarnessWorld,
  white = 'alice',
  black = 'bob',
  timeControl = '5+0'
) {
  await givenBegunGame(w, white, black, timeControl);
  return resignedBySecond(w);
}
