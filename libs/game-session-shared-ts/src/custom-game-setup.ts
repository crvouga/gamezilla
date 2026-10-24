import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type {
  GameSetups,
  PrivateSetupRules,
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
 * The private setups of a space's custom games. A setup is chosen with its
 * side's readiness and recorded as an event only its person reads (a bot's
 * is read by nobody): the room holds every setup, a device only its own
 * person's, and the custom game itself, which everyone in the space sees,
 * holds none.
 */

const setupSchema = z.string().min(1).max(512);
const setupChosenSchema = z
  .object({
    gameId: z.string().min(1),
    side: z.enum(CUSTOM_GAME_SIDES),
    /** The person the setup is private to; empty for a bot's. */
    person: z.string(),
    setup: setupSchema,
  })
  .strict();
export type CustomGameSetupChosenPayload = z.infer<typeof setupChosenSchema>;
export const CustomGameSetupChosen = customGameEvtNs(
  'setup-chosen',
  (p): p is CustomGameSetupChosenPayload =>
    setupChosenSchema.safeParse(p).success
);

const setupsSchema = z.record(
  z.string(),
  z
    .object({
      white: setupSchema,
      black: setupSchema,
      red: setupSchema,
      blue: setupSchema,
    })
    .partial()
    .strict()
);
type CustomGameSetups = z.infer<typeof setupsSchema>;
const ns = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'custom');
export const CustomGameSetupsAttr = ns.json(
  'setups',
  (v): CustomGameSetups => (v === undefined ? {} : setupsSchema.parse(v))
);

/** A setup event is read only by its person; every other custom-game event is public. */
export function customGameSetupAudience(
  event: Message
): readonly string[] | null {
  if (!CustomGameSetupChosen.is(event)) return null;
  return event.payload.person === '' ? [] : [event.payload.person];
}

export function reduceCustomGameSetup(
  state: RoomState,
  event: CustomGameSetupChosenPayload
): RoomState {
  const setups = CustomGameSetupsAttr.from(state);
  return {
    ...state,
    ...CustomGameSetupsAttr({
      ...setups,
      [event.gameId]: { ...setups[event.gameId], [event.side]: event.setup },
    }),
  };
}

/** The setups of the games still kept, so a finished game's own setup stays reviewable. */
export function keptCustomGameSetups(
  state: RoomState,
  games: CustomGames
): RoomState {
  const setups = CustomGameSetupsAttr.from(state);
  const kept = [...games.history, ...(games.current ? [games.current] : [])];
  const next: CustomGameSetups = {};
  for (const game of kept) {
    const setup = setups[game.id];
    if (setup !== undefined) next[game.id] = setup;
  }
  return Object.keys(next).length === Object.keys(setups).length
    ? state
    : { ...state, ...CustomGameSetupsAttr(next) };
}

/** The game's private setup rules, when its sides prepare one. */
export function customGameSetupRules(
  game: CustomGame,
  rules: TurnGames
): PrivateSetupRules | undefined {
  return rules.forPosition(game.fen).setup;
}

/** Both sides' setups, as only the authority holds them together; `null` until both exist. */
export function customGameSetups(
  state: RoomState,
  game: CustomGame
): GameSetups | null {
  const setup = CustomGameSetupsAttr.from(state)[game.id];
  return setup?.white === undefined || setup.black === undefined
    ? null
    : game.sides.some((side) => setup[side] === undefined)
      ? null
      : {
          white: setup.white,
          black: setup.black,
          ...(setup.red === undefined ? {} : { red: setup.red }),
          ...(setup.blue === undefined ? {} : { blue: setup.blue }),
        };
}

/** The sides of `game` whose setup this copy of the space holds. */
export function customGameSetupSides(
  state: RoomState,
  game: CustomGame
): readonly CustomGameSide[] {
  const setup = CustomGameSetupsAttr.from(state)[game.id] ?? {};
  return game.sides.filter((side) => setup[side] !== undefined);
}

/** `person`'s own setup for `game`, as their copy of the space holds it. */
export function ownCustomGameSetup(
  state: RoomState,
  game: CustomGame,
  person: string
): string | null {
  const side = customGamePersonSide(game, person);
  if (side === null) return null;
  return CustomGameSetupsAttr.from(state)[game.id]?.[side] ?? null;
}

export function customGameSetupChosen(
  game: CustomGame,
  side: CustomGameSide,
  setup: string
): Message {
  return CustomGameSetupChosen({
    gameId: game.id,
    side,
    person: game[side].kind === 'person' ? game[side].person : '',
    setup,
  });
}
