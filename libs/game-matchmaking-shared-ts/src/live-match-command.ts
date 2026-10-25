import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { MultiplayerGame } from './game-state';
import {
  DecideMultiplayerGame,
  type MatchDecision,
  multiplayerGameFromRoom,
} from './match-intent';
import {
  MultiplayerGameChanged,
  matchRoomGame,
  matchRoomTopic,
} from './match-room';

/** The room decides once; SQL can safely retry projecting that decision after a rollback. */
export async function runLiveMatchCommand(
  rooms: RoomServicePort,
  game: MultiplayerGame,
  intent: MatchDecision & { readonly actorId: string },
  requestId: string
): Promise<MultiplayerGame> {
  const topic = matchRoomTopic(game.id);
  const seeded = await rooms.send(
    topic,
    `match:${game.id}:initial`,
    MultiplayerGameChanged(game)
  );
  if (!seeded.ok) throw new Error('could not initialize the matched room');
  const receipt = await rooms.send(
    topic,
    `match-command:${JSON.stringify([intent.actorId, requestId])}`,
    DecideMultiplayerGame({ ...intent, gameId: game.id })
  );
  if (!receipt.ok) {
    const error = receipt.error;
    throw new MutationError(
      'code' in error
        ? (error.code ?? 'GAME_COMMAND_REFUSED')
        : 'GAME_COMMAND_REFUSED',
      'reason' in error
        ? (error.reason ?? 'This game is unavailable. Try again.')
        : 'This game is unavailable. Try again.'
    );
  }
  const accepted = matchRoomGame(receipt.state);
  if (accepted === null || accepted.id !== game.id)
    throw new Error('missing authoritative match receipt');
  return multiplayerGameFromRoom(accepted);
}
