import { createMessageNamespace } from '@pkgs/message-shared-ts/message';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared-ts/service-identity';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { z } from 'zod';
import { playMultiplayerMove } from './game';
import {
  abortGame,
  acceptDraw,
  declineDraw,
  offerDraw,
  resignGame,
} from './game-decisions';
import type { MultiplayerGame } from './game-state';
import type { MatchRoomGame } from './match-room';

const simpleKinds = z.enum([
  'abort',
  'resign',
  'offer-draw',
  'accept-draw',
  'decline-draw',
  'sync',
]);
const simpleDecision = z.object({ kind: simpleKinds });
const moveDecision = z.object({
  kind: z.literal('move'),
  revision: z.number().int().nonnegative(),
  uci: z.string().min(1).max(256),
  /** Trusted server input only; never published in a room event. */
  setups: z
    .object({ white: z.string(), black: z.string() })
    .strict()
    .nullable(),
});
const actor = { gameId: z.string().min(1), actorId: z.string().min(1) };
const intentSchema = z.discriminatedUnion('kind', [
  simpleDecision.extend(actor).strict(),
  moveDecision.extend(actor).strict(),
]);
export type MatchDecision =
  | z.infer<typeof simpleDecision>
  | z.infer<typeof moveDecision>;
export type MatchIntent = z.infer<typeof intentSchema>;
export function isMatchIntentKind(value: string): value is MatchIntent['kind'] {
  return value === 'move' || simpleKinds.safeParse(value).success;
}
/** Only the host may supply the authenticated actor; this is never a socket command. */
export const DecideMultiplayerGame = createMessageNamespace('game-match')(
  'decide',
  (value): value is MatchIntent => intentSchema.safeParse(value).success
);

export function decideMatchIntent(
  game: MultiplayerGame,
  intent: MatchIntent,
  context: {
    readonly started: boolean;
    readonly nowMs: number;
    readonly rules: TurnGames;
  }
): MultiplayerGame {
  if (
    game.id !== intent.gameId ||
    (![game.white_id, game.black_id].includes(intent.actorId) &&
      !(intent.kind === 'sync' && intent.actorId === ROOM_SERVICE_IDENTITY))
  )
    throw new MutationError(
      'CHESS_GAME_UNAVAILABLE',
      'No multiplayer game is available to you.'
    );
  switch (intent.kind) {
    case 'move':
      return playMultiplayerMove(
        game,
        {
          actorId: intent.actorId,
          revision: intent.revision,
          uci: intent.uci,
          setups: intent.setups,
          nowMs: context.nowMs,
        },
        context.rules
      ).game;
    case 'resign':
      return resignGame(game, intent.actorId, context.started);
    case 'abort':
      return abortGame(game, context.started);
    case 'offer-draw':
      return offerDraw(game, intent.actorId);
    case 'accept-draw':
      return acceptDraw(game, intent.actorId);
    case 'decline-draw':
      return declineDraw(game, intent.actorId);
    case 'sync':
      return game;
  }
}

/** Optional wire fields absent from a delivery are explicit nulls in the domain. */
const NULLABLE_ROOM_FIELDS = [
  'red_id',
  'blue_id',
  'time_control',
  'white_ms',
  'black_ms',
  'red_ms',
  'blue_ms',
  'clock_at_ms',
  'draw_offer_by',
  'rematch_offer_by',
  'rematch_of',
  'white_rating',
  'black_rating',
  'red_rating',
  'blue_rating',
  'white_rating_diff',
  'black_rating_diff',
  'red_rating_diff',
  'blue_rating_diff',
  'draw_votes',
  'rematch_votes',
  'setup_ready',
] as const satisfies readonly (keyof MatchRoomGame & keyof MultiplayerGame)[];

/** Optional wire clock fields are normalized only at the domain decision boundary. */
export function multiplayerGameFromRoom(game: MatchRoomGame): MultiplayerGame {
  const normalized: Record<string, unknown> = { ...game };
  for (const field of NULLABLE_ROOM_FIELDS)
    normalized[field] = game[field] ?? null;
  return normalized as MultiplayerGame;
}
