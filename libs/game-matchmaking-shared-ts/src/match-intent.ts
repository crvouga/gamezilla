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
      );
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

/** Seats beyond the first two, and their group votes, as a group game stores them. */
function extraSeatFields(game: MatchRoomGame) {
  return {
    red_id: game.red_id ?? null,
    blue_id: game.blue_id ?? null,
    red_ms: game.red_ms ?? null,
    blue_ms: game.blue_ms ?? null,
    red_rating: game.red_rating ?? null,
    blue_rating: game.blue_rating ?? null,
    red_rating_diff: game.red_rating_diff ?? null,
    blue_rating_diff: game.blue_rating_diff ?? null,
    draw_votes: game.draw_votes ?? null,
    rematch_votes: game.rematch_votes ?? null,
  };
}

/** Optional wire clock fields are normalized only at the domain decision boundary. */
export function multiplayerGameFromRoom(game: MatchRoomGame): MultiplayerGame {
  return {
    ...game,
    ...extraSeatFields(game),
    time_control: game.time_control ?? null,
    white_ms: game.white_ms ?? null,
    black_ms: game.black_ms ?? null,
    clock_at_ms: game.clock_at_ms ?? null,
    draw_offer_by: game.draw_offer_by ?? null,
    rematch_offer_by: game.rematch_offer_by ?? null,
    rematch_of: game.rematch_of ?? null,
    white_rating: game.white_rating ?? null,
    black_rating: game.black_rating ?? null,
    white_rating_diff: game.white_rating_diff ?? null,
    black_rating_diff: game.black_rating_diff ?? null,
    setup_ready: game.setup_ready ?? null,
  };
}
