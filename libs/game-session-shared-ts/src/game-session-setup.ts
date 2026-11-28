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
import { gameSessionEvtNs } from './game-session-commands';
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
 * The private setups of a space's game sessions. A setup is chosen with its
 * side's readiness and recorded as an event only its person reads (a bot's
 * is read by nobody): the room holds every setup, a device only its own
 * person's, and the game session itself, which everyone in the space sees,
 * holds none.
 */

const setupSchema = z.string().min(1).max(512);
const setupChosenSchema = z
  .object({
    gameId: z.string().min(1),
    side: z.enum(GAME_SESSION_SIDES),
    /** The person the setup is private to; empty for a bot's. */
    person: z.string(),
    setup: setupSchema,
  })
  .strict();
export type GameSessionSetupChosenPayload = z.infer<typeof setupChosenSchema>;
export const GameSessionSetupChosen = gameSessionEvtNs(
  'setup-chosen',
  (p): p is GameSessionSetupChosenPayload =>
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
type GameSessionSetups = z.infer<typeof setupsSchema>;
const ns = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'custom');
export const GameSessionSetupsAttr = ns.json(
  'setups',
  (v): GameSessionSetups => (v === undefined ? {} : setupsSchema.parse(v))
);

/** A setup event is read only by its person; every other game-session event is public. */
export function gameSessionSetupAudience(
  event: Message
): readonly string[] | null {
  if (!GameSessionSetupChosen.is(event)) return null;
  return event.payload.person === '' ? [] : [event.payload.person];
}

export function reduceGameSessionSetup(
  state: RoomState,
  event: GameSessionSetupChosenPayload
): RoomState {
  const setups = GameSessionSetupsAttr.from(state);
  return {
    ...state,
    ...GameSessionSetupsAttr({
      ...setups,
      [event.gameId]: { ...setups[event.gameId], [event.side]: event.setup },
    }),
  };
}

/** The setups of the games still kept, so a finished game's own setup stays reviewable. */
export function keptGameSessionSetups(
  state: RoomState,
  games: GameSessions
): RoomState {
  const setups = GameSessionSetupsAttr.from(state);
  const kept = [...games.history, ...(games.current ? [games.current] : [])];
  const next: GameSessionSetups = {};
  for (const game of kept) {
    const setup = setups[game.id];
    if (setup !== undefined) next[game.id] = setup;
  }
  return Object.keys(next).length === Object.keys(setups).length
    ? state
    : { ...state, ...GameSessionSetupsAttr(next) };
}

/** The game's private setup rules, when its sides prepare one. */
export function gameSessionSetupRules(
  game: GameSession,
  rules: TurnGames
): PrivateSetupRules | undefined {
  return rules.forPosition(game.fen).setup;
}

/** Both sides' setups, as only the authority holds them together; `null` until both exist. */
export function gameSessionSetups(
  state: RoomState,
  game: GameSession
): GameSetups | null {
  const setup = GameSessionSetupsAttr.from(state)[game.id];
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
export function gameSessionSetupSides(
  state: RoomState,
  game: GameSession
): readonly GameSessionSide[] {
  const setup = GameSessionSetupsAttr.from(state)[game.id] ?? {};
  return game.sides.filter((side) => setup[side] !== undefined);
}

/** `person`'s own setup for `game`, as their copy of the space holds it. */
export function ownGameSessionSetup(
  state: RoomState,
  game: GameSession,
  person: string
): string | null {
  const side = gameSessionPersonSide(game, person);
  if (side === null) return null;
  return GameSessionSetupsAttr.from(state)[game.id]?.[side] ?? null;
}

export function gameSessionSetupChosen(
  game: GameSession,
  side: GameSessionSide,
  setup: string
): Message {
  return GameSessionSetupChosen({
    gameId: game.id,
    side,
    person: game[side].kind === 'person' ? game[side].person : '',
    setup,
  });
}
