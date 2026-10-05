import { createMessageNamespace } from '@pkgs/message-shared/message';
import { hashRoomState } from '@pkgs/room-root-shared/hash-room-state';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared/service-identity';
import type { RoomModule, RoomState } from '@pkgs/room-root-shared/types';
import { assertRoomModuleName, ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import type { Message } from '@pkgs/message-shared/message';
import { asKeyword } from '@pkgs/keyword-shared/keyword';
import { z } from 'zod';
const MATCH_GAME_KEY = asKeyword('chess-match/game');
import type { MultiplayerGame } from './game';

export const MATCH_ROOM_MODULE = 'chess-match';
export const matchRoomTopic = (gameId: string): string => `${MATCH_ROOM_MODULE}:${gameId}`;
const gameSchema = z.object({
  id: z.string().min(1), white_id: z.string(), black_id: z.string(),
  fen: z.string(), pgn: z.string(), revision: z.number().int().nonnegative(),
  turn: z.string(), outcome: z.enum(['ongoing', 'white', 'black', 'draw']),
  reason: z.string().nullable(),
});
export const MultiplayerGameChanged = createMessageNamespace('chess-match')(
  'game-changed', (value): value is MultiplayerGame => gameSchema.safeParse(value).success
);

export function matchRoomGame(state: RoomState): MultiplayerGame | null {
  const value = state[MATCH_GAME_KEY];
  return gameSchema.safeParse(value).success ? value as MultiplayerGame : null;
}

/** One accepted match, shared by the clients in both spaces. Only mutation
 * deliveries can change its board; connected watchers cannot forge events. */
export const matchRoomModule: RoomModule<RoomState, Message, Message, string> = {
  name: assertRoomModuleName(MATCH_ROOM_MODULE),
  recoverEffects: () => [],
  initialState: () => ({}),
  handle(state, command, identity) {
    if (identity !== ROOM_SERVICE_IDENTITY || !MultiplayerGameChanged.is(command.payload))
      return { ok: false, error: { type: ROOM_ERROR_TYPE.invalidCommand, reason: 'only accepted multiplayer mutations change the match' } };
    const game = command.payload.payload;
    const current = matchRoomGame(state);
    if (current !== null && (current.id !== game.id || current.revision > game.revision ||
      (current.revision === game.revision && current.outcome !== 'ongoing')))
      return { ok: true, events: [] };
    return { ok: true, events: [MultiplayerGameChanged(game)] };
  },
  reduce(state, event) {
    return MultiplayerGameChanged.is(event) ? { ...state, [MATCH_GAME_KEY]: event.payload } : state;
  },
  hash: hashRoomState,
};
