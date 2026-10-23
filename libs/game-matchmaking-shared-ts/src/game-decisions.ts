import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { MultiplayerGame } from './game-state';
import {
  bothHaveMoved,
  endMultiplayerGame,
  otherPerson,
  requireUnfinished,
} from './game-state';
import {
  multiplayerPeople,
  multiplayerSides,
  multiplayerVotes,
} from './multiplayer-roster';

/** Once both people have moved, either may give up the game, whoever's turn it is. */
export function resignGame(
  game: MultiplayerGame,
  actorId: string
): MultiplayerGame {
  requireUnfinished(game);
  if (!bothHaveMoved(game))
    throw new MutationError(
      'CHESS_ABORT_INSTEAD',
      'Abort the multiplayer game instead: resigning waits until both people have moved.'
    );
  if (multiplayerSides(game).length > 2)
    return endMultiplayerGame(game, 'draw', 'participant withdrew');
  return endMultiplayerGame(
    game,
    game.white_id === actorId ? 'black' : 'white',
    'resignation'
  );
}

/** Until both people have moved, either may end the game with no result. */
export function abortGame(game: MultiplayerGame): MultiplayerGame {
  requireUnfinished(game);
  if (bothHaveMoved(game))
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
  if (multiplayerSides(game).length > 2) {
    const offer = game.draw_offer_by;
    const votes = offer ? multiplayerVotes(game, game.draw_votes) : [];
    return consentToDraw(
      { ...game, draw_offer_by: offer || actorId },
      actorId,
      votes
    );
  }
  if (game.draw_offer_by === otherPerson(game, actorId))
    return drawByAgreement(game);
  return { ...game, draw_offer_by: actorId };
}

function consentToDraw(
  game: MultiplayerGame,
  actorId: string,
  prior: readonly string[]
): MultiplayerGame {
  const votes = [...new Set([...prior, actorId])];
  return multiplayerPeople(game).every((person) => votes.includes(person))
    ? drawByAgreement(game)
    : { ...game, draw_votes: JSON.stringify(votes) };
}

function requireOfferedDraw(game: MultiplayerGame, actorId: string): void {
  requireUnfinished(game);
  if (game.draw_offer_by === actorId)
    throw new MutationError(
      'CHESS_OWN_DRAW_OFFER',
      'Only your multiplayer opponent may answer your multiplayer draw offer.'
    );
  if (
    !game.draw_offer_by ||
    !multiplayerPeople(game).includes(game.draw_offer_by)
  )
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
  return multiplayerSides(game).length > 2
    ? consentToDraw(game, actorId, multiplayerVotes(game, game.draw_votes))
    : drawByAgreement(game);
}

export function declineDraw(
  game: MultiplayerGame,
  actorId: string
): MultiplayerGame {
  requireOfferedDraw(game, actorId);
  return { ...game, draw_offer_by: '', draw_votes: null };
}
