import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type {
  DealtHandsRules,
  TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { z } from 'zod';
import { customGameEvtNs } from './custom-game-commands';
import type {
  CustomGame,
  CustomGameSide,
  CustomGames,
} from './custom-game-state';
import { CUSTOM_GAME_SIDES, customGamePersonSide } from './custom-game-state';

/**
 * The dealt hands of a space's custom games. The room deals a game's hidden
 * state as it starts and replaces it after every accepted action, each time
 * as an event nobody reads; each side's hand travels as an event only its
 * person reads (a bot's, nobody). So the room holds the hidden state and
 * every hand, a device only its own person's hand, and the custom game
 * itself, which everyone in the space sees, holds neither.
 */

const hiddenSchema = z.string().min(1).max(4096);
const handSchema = z.string().max(512);

const hiddenDealtSchema = z
  .object({ gameId: z.string().min(1), hidden: hiddenSchema })
  .strict();
export type CustomGameHiddenDealtPayload = z.infer<typeof hiddenDealtSchema>;
export const CustomGameHiddenDealt = customGameEvtNs(
  'hidden-dealt',
  (p): p is CustomGameHiddenDealtPayload =>
    hiddenDealtSchema.safeParse(p).success
);

const handShownSchema = z
  .object({
    gameId: z.string().min(1),
    side: z.enum(CUSTOM_GAME_SIDES),
    /** The person the hand is private to; empty for a bot's. */
    person: z.string(),
    hand: handSchema,
  })
  .strict();
export type CustomGameHandShownPayload = z.infer<typeof handShownSchema>;
export const CustomGameHandShown = customGameEvtNs(
  'hand-shown',
  (p): p is CustomGameHandShownPayload => handShownSchema.safeParse(p).success
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
type CustomGameHands = z.infer<typeof handsSchema>;
const ns = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'custom');
export const CustomGameHandsAttr = ns.json(
  'hands',
  (v): CustomGameHands => (v === undefined ? {} : handsSchema.parse(v))
);

/** The hidden state is read by nobody; a hand only by its person. */
export function customGameHandsAudience(
  event: Message
): readonly string[] | null {
  if (CustomGameHiddenDealt.is(event)) return [];
  if (!CustomGameHandShown.is(event)) return null;
  return event.payload.person === '' ? [] : [event.payload.person];
}

export function reduceCustomGameHidden(
  state: RoomState,
  event: CustomGameHiddenDealtPayload
): RoomState {
  const all = CustomGameHandsAttr.from(state);
  const game = all[event.gameId] ?? { hands: {} };
  return {
    ...state,
    ...CustomGameHandsAttr({
      ...all,
      [event.gameId]: { ...game, hidden: event.hidden },
    }),
  };
}

export function reduceCustomGameHand(
  state: RoomState,
  event: CustomGameHandShownPayload
): RoomState {
  const all = CustomGameHandsAttr.from(state);
  const game = all[event.gameId] ?? { hands: {} };
  return {
    ...state,
    ...CustomGameHandsAttr({
      ...all,
      [event.gameId]: {
        ...game,
        hands: { ...game.hands, [event.side]: event.hand },
      },
    }),
  };
}

/** The hands of the games still kept, so a finished game's own hand stays reviewable. */
export function keptCustomGameHands(
  state: RoomState,
  games: CustomGames
): RoomState {
  const all = CustomGameHandsAttr.from(state);
  const kept = [...games.history, ...(games.current ? [games.current] : [])];
  const next: CustomGameHands = {};
  for (const game of kept) {
    const hands = all[game.id];
    if (hands !== undefined) next[game.id] = hands;
  }
  return Object.keys(next).length === Object.keys(all).length
    ? state
    : { ...state, ...CustomGameHandsAttr(next) };
}

/** The game's dealt-hands rules, when its authority deals hands. */
export function customGameHandsRules(
  game: CustomGame,
  rules: TurnGames
): DealtHandsRules | undefined {
  return rules.forPosition(game.fen).hands;
}

/** The game's hidden state, as only the room holds it; `null` until dealt. */
export function customGameHidden(
  state: RoomState,
  game: CustomGame
): string | null {
  return CustomGameHandsAttr.from(state)[game.id]?.hidden ?? null;
}

/** `side`'s hand, as this copy of the space holds it. */
export function customGameHand(
  state: RoomState,
  game: CustomGame,
  side: CustomGameSide
): string | null {
  return CustomGameHandsAttr.from(state)[game.id]?.hands[side] ?? null;
}

/** `person`'s own hand in `game`, as their copy of the space holds it. */
export function ownCustomGameHand(
  state: RoomState,
  game: CustomGame,
  person: string
): string | null {
  const side = customGamePersonSide(game, person);
  return side === null ? null : customGameHand(state, game, side);
}

/**
 * The events recording `hidden` as `game`'s hidden state: the state for
 * nobody, then each side's hand for its person — only the hands that
 * changed, unless every hand is shown (`all`).
 */
export function customGameHandEvents(
  state: RoomState,
  game: CustomGame,
  change: {
    readonly hidden: string;
    readonly hands: DealtHandsRules;
    readonly all: boolean;
  }
): readonly Message[] {
  const events: Message[] = [
    CustomGameHiddenDealt({ gameId: game.id, hidden: change.hidden }),
  ];
  for (const side of game.sides) {
    const hand = change.hands.hand(change.hidden, side);
    if (!change.all && customGameHand(state, game, side) === hand) continue;
    events.push(
      CustomGameHandShown({
        gameId: game.id,
        side,
        person: game[side].kind === 'person' ? game[side].person : '',
        hand,
      })
    );
  }
  return events;
}
