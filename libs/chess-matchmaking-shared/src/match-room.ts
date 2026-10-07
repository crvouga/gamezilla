import { asKeyword } from '@pkgs/keyword-shared/keyword';
import type { Message } from '@pkgs/message-shared/message';
import { createMessageNamespace } from '@pkgs/message-shared/message';
import { hashRoomState } from '@pkgs/room-root-shared/hash-room-state';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared/service-identity';
import type { RoomModule, RoomState } from '@pkgs/room-root-shared/types';
import {
  assertRoomModuleName,
  ROOM_ERROR_TYPE,
} from '@pkgs/room-root-shared/types';
import { z } from 'zod';

const MATCH_GAME_KEY = asKeyword('chess-match/game');

export const MATCH_ROOM_MODULE = 'chess-match';
export const matchRoomTopic = (gameId: string): string =>
  `${MATCH_ROOM_MODULE}:${gameId}`;
const gameSchema = z.object({
  id: z.string().min(1),
  white_id: z.string(),
  black_id: z.string(),
  fen: z.string(),
  pgn: z.string(),
  revision: z.number().int().nonnegative(),
  turn: z.string(),
  outcome: z.enum(['ongoing', 'white', 'black', 'draw', 'aborted']),
  reason: z.string().nullable(),
  time_control: z.string().nullable().optional(),
  white_ms: z.number().nullable().optional(),
  black_ms: z.number().nullable().optional(),
  clock_at_ms: z.number().nullable().optional(),
  draw_offer_by: z.string().nullable().optional(),
  rematch_offer_by: z.string().nullable().optional(),
  rematch_of: z.string().nullable().optional(),
  white_rating: z.string().nullable().optional(),
  black_rating: z.string().nullable().optional(),
  white_rating_diff: z.number().nullable().optional(),
  black_rating_diff: z.number().nullable().optional(),
});
/** The accepted game a match room shares. Clock fields travel with a timed game. */
export type MatchRoomGame = z.infer<typeof gameSchema>;
export const MultiplayerGameChanged = createMessageNamespace('chess-match')(
  'game-changed',
  (value): value is MatchRoomGame => gameSchema.safeParse(value).success
);

export function matchRoomGame(state: RoomState): MatchRoomGame | null {
  const parsed = gameSchema.safeParse(state[MATCH_GAME_KEY]);
  return parsed.success ? parsed.data : null;
}

/** One accepted match, shared by the clients in both spaces. Only mutation
 * deliveries can change its board; connected watchers cannot forge events. */
export const matchRoomModule: RoomModule<RoomState, Message, Message, string> =
  {
    name: assertRoomModuleName(MATCH_ROOM_MODULE),
    recoverEffects: () => [],
    initialState: () => ({}),
    handle(state, command, identity) {
      if (
        identity !== ROOM_SERVICE_IDENTITY ||
        !MultiplayerGameChanged.is(command.payload)
      )
        return {
          ok: false,
          error: {
            type: ROOM_ERROR_TYPE.invalidCommand,
            reason: 'only accepted multiplayer mutations change the match',
          },
        };
      const game = command.payload.payload;
      const current = matchRoomGame(state);
      if (
        current !== null &&
        (current.id !== game.id ||
          current.revision > game.revision ||
          (current.outcome !== 'ongoing' && game.outcome === 'ongoing'))
      )
        return { ok: true, events: [] };
      const published =
        current === null
          ? game
          : {
              ...game,
              white_id: current.white_id.startsWith('deleted:')
                ? current.white_id
                : game.white_id,
              black_id: current.black_id.startsWith('deleted:')
                ? current.black_id
                : game.black_id,
            };
      return { ok: true, events: [MultiplayerGameChanged(published)] };
    },
    reduce(state, event) {
      return MultiplayerGameChanged.is(event)
        ? { ...state, [MATCH_GAME_KEY]: event.payload }
        : state;
    },
    hash: hashRoomState,
  };
