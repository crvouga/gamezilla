import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type {
  DealtHandsRules,
  TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { z } from 'zod';
import { gameSessionEvtNs } from './game-session-commands';
import { creatorAloneInGameSession } from './game-session-solo';
import type {
  GameSession,
  GameSessionSide,
  GameSessions,
} from './game-session-state';
import {
  GAME_SESSION_SIDES,
  gameSessionPersonSide,
} from './game-session-state';

/**
 * The dealt hands of a space's game sessions. The room deals a game's hidden
 * state as it starts and replaces it after every accepted action, each time
 * as an event nobody reads; each side's hand travels as an event only its
 * person reads (a bot's, nobody). So the room holds the hidden state and
 * every hand, a device only its own person's hand, and the game session
 * itself, which everyone in the space sees, holds neither. In a solo game —
 * its creator practising against bots — the creator also reads the hidden
 * state and the bots' hands (`reader`), so their device can play offline;
 * no other person ever does.
 */

const hiddenSchema = z.string().min(1).max(4096);
const handSchema = z.string().max(512);

const readerSchema = z.string().max(256).optional();

const hiddenDealtSchema = z
  .object({
    gameId: z.string().min(1),
    hidden: hiddenSchema,
    /** The creator of a solo game, who may read it; absent, nobody. */
    reader: readerSchema,
  })
  .strict();
export type GameSessionHiddenDealtPayload = z.infer<typeof hiddenDealtSchema>;
export const GameSessionHiddenDealt = gameSessionEvtNs(
  'hidden-dealt',
  (p): p is GameSessionHiddenDealtPayload =>
    hiddenDealtSchema.safeParse(p).success
);

const handShownSchema = z
  .object({
    gameId: z.string().min(1),
    side: z.enum(GAME_SESSION_SIDES),
    /** The person the hand is private to; empty for a bot's. */
    person: z.string(),
    hand: handSchema,
    /** For a bot's hand in a solo game, its creator, who may read it. */
    reader: readerSchema,
  })
  .strict();
export type GameSessionHandShownPayload = z.infer<typeof handShownSchema>;
export const GameSessionHandShown = gameSessionEvtNs(
  'hand-shown',
  (p): p is GameSessionHandShownPayload => handShownSchema.safeParse(p).success
);

const handsSchema = z.record(
  z.string(),
  z
    .object({
      hidden: hiddenSchema.optional(),
      hands: z
        .object({
          white: handSchema,
          black: handSchema,
          red: handSchema,
          blue: handSchema,
        })
        .partial()
        .strict(),
    })
    .strict()
);
type GameSessionHands = z.infer<typeof handsSchema>;
const ns = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'custom');
export const GameSessionHandsAttr = ns.json(
  'hands',
  (v): GameSessionHands => (v === undefined ? {} : handsSchema.parse(v))
);

/** The hidden state is read by nobody; a hand only by its person. */
export function gameSessionHandsAudience(
  event: Message
): readonly string[] | null {
  if (GameSessionHiddenDealt.is(event))
    return event.payload.reader === undefined ? [] : [event.payload.reader];
  if (!GameSessionHandShown.is(event)) return null;
  if (event.payload.person !== '') return [event.payload.person];
  return event.payload.reader === undefined ? [] : [event.payload.reader];
}

export function reduceGameSessionHidden(
  state: RoomState,
  event: GameSessionHiddenDealtPayload
): RoomState {
  const all = GameSessionHandsAttr.from(state);
  const game = all[event.gameId] ?? { hands: {} };
  return {
    ...state,
    ...GameSessionHandsAttr({
      ...all,
      [event.gameId]: { ...game, hidden: event.hidden },
    }),
  };
}

export function reduceGameSessionHand(
  state: RoomState,
  event: GameSessionHandShownPayload
): RoomState {
  const all = GameSessionHandsAttr.from(state);
  const game = all[event.gameId] ?? { hands: {} };
  return {
    ...state,
    ...GameSessionHandsAttr({
      ...all,
      [event.gameId]: {
        ...game,
        hands: { ...game.hands, [event.side]: event.hand },
      },
    }),
  };
}

/** The hands of the games still kept, so a finished game's own hand stays reviewable. */
export function keptGameSessionHands(
  state: RoomState,
  games: GameSessions
): RoomState {
  const all = GameSessionHandsAttr.from(state);
  const kept = [...games.history, ...(games.current ? [games.current] : [])];
  const next: GameSessionHands = {};
  for (const game of kept) {
    const hands = all[game.id];
    if (hands !== undefined) next[game.id] = hands;
  }
  return Object.keys(next).length === Object.keys(all).length
    ? state
    : { ...state, ...GameSessionHandsAttr(next) };
}

/** The game's dealt-hands rules, when its authority deals hands. */
export function gameSessionHandsRules(
  game: GameSession,
  rules: TurnGames
): DealtHandsRules | undefined {
  return rules.turnsForPosition(game.fen)?.hands;
}

/** The game's hidden state, as only the room holds it; `null` until dealt. */
export function gameSessionHidden(
  state: RoomState,
  game: GameSession
): string | null {
  return GameSessionHandsAttr.from(state)[game.id]?.hidden ?? null;
}

/** `side`'s hand, as this copy of the space holds it. */
export function gameSessionHand(
  state: RoomState,
  game: GameSession,
  side: GameSessionSide
): string | null {
  return GameSessionHandsAttr.from(state)[game.id]?.hands[side] ?? null;
}

/** `person`'s own hand in `game`, as their copy of the space holds it. */
export function ownGameSessionHand(
  state: RoomState,
  game: GameSession,
  person: string
): string | null {
  const side = gameSessionPersonSide(game, person);
  return side === null ? null : gameSessionHand(state, game, side);
}

/**
 * The events recording `hidden` as `game`'s hidden state: the state for
 * nobody, then each side's hand for its person — only the hands that
 * changed, unless every hand is shown (`all`).
 */
export function gameSessionHandEvents(
  state: RoomState,
  game: GameSession,
  change: {
    readonly hidden: string;
    readonly hands: DealtHandsRules;
    readonly all: boolean;
  }
): readonly Message[] {
  // A solo game's creator reads what the room alone reads otherwise.
  const reader = creatorAloneInGameSession(game)
    ? { reader: game.creator }
    : {};
  const events: Message[] = [
    GameSessionHiddenDealt({
      gameId: game.id,
      hidden: change.hidden,
      ...reader,
    }),
  ];
  for (const side of game.sides) {
    const hand = change.hands.hand(change.hidden, side);
    if (!change.all && gameSessionHand(state, game, side) === hand) continue;
    const person = game[side].kind === 'person' ? game[side].person : '';
    events.push(
      GameSessionHandShown({
        gameId: game.id,
        side,
        person,
        hand,
        ...(person === '' ? reader : {}),
      })
    );
  }
  return events;
}
