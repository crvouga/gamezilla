import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { MultiplayerGame } from './game-state';
import {
  bothHaveMoved,
  endMultiplayerGame,
  otherPerson,
  requireUnfinished,
} from './game-state';

/** Once play begins, either may give up the game, whoever's turn it is. */
export function resignGame(
  game: MultiplayerGame,
  actorId: string,
  started = bothHaveMoved(game)
): MultiplayerGame {
  requireUnfinished(game);
  if (!started)
    throw new MutationError(
      'CHESS_ABORT_INSTEAD',
      'Abort the multiplayer game instead: resigning waits until play begins.'
    );
  return endMultiplayerGame(
    game,
    game.white_id === actorId ? 'black' : 'white',
    'resignation'
  );
}

/** Before play begins, either may end the game with no result. */
export function abortGame(
  game: MultiplayerGame,
  started = bothHaveMoved(game)
): MultiplayerGame {
  requireUnfinished(game);
  if (started)
    throw new MutationError(
      'CHESS_ABORT_TOO_LATE',
      'The multiplayer game can no longer be aborted.'
    );
  return endMultiplayerGame(game, 'aborted', 'abort');
}

function drawByAgreement(game: MultiplayerGame): MultiplayerGame {
  return endMultiplayerGame(game, 'draw', 'agreement');
}

/** Offering a draw back accepts the waiting offer; offering twice keeps one. */
export function offerDraw(
  game: MultiplayerGame,
  actorId: string
): MultiplayerGame {
  requireUnfinished(game);
  if (game.draw_offer_by === otherPerson(game, actorId))
    return drawByAgreement(game);
  return { ...game, draw_offer_by: actorId };
}

function requireOfferedDraw(game: MultiplayerGame, actorId: string): void {
  requireUnfinished(game);
  if (game.draw_offer_by === actorId)
    throw new MutationError(
      'CHESS_OWN_DRAW_OFFER',
      'Only your multiplayer opponent may answer your multiplayer draw offer.'
    );
  if (game.draw_offer_by !== otherPerson(game, actorId))
    throw new MutationError(
      'CHESS_NO_DRAW_OFFER',
      'No multiplayer draw offer is waiting.'
    );
}

export function acceptDraw(
  game: MultiplayerGame,
  actorId: string
): MultiplayerGame {
  requireOfferedDraw(game, actorId);
  return drawByAgreement(game);
}

export function declineDraw(
  game: MultiplayerGame,
  actorId: string
): MultiplayerGame {
  requireOfferedDraw(game, actorId);
  return { ...game, draw_offer_by: '' };
}
