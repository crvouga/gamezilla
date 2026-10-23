import { matchRoomModule } from '@libs/game-matchmaking-shared-ts/match-room';
import { PUZZLE_SESSIONS } from '@libs/game-puzzle-shared-ts/puzzle-sessions';
import type {
  GameDefinition,
  GameOwnRoom,
  SharedGameModule,
} from '@libs/spaces-shared-ts/game';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { GameAutomation } from '@pkgs/turn-game-shared-ts/game-automation';
import type {
  GameRules,
  RegisteredTurnGame,
  TurnGameCapabilities,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { withCustomGames } from './custom-game-definition';
import { assertTurnGameCapabilities } from './turn-game-capabilities';

/**
 * The turn-game session engine: one per space, bound to every registered
 * turn game's rules — custom games in the space and the rooms of matched
 * games. Installed by `defineTurnGame`, never named by a game.
 */
const TURN_GAME_SESSIONS: SharedGameModule = {
  id: 'turn-game-session',
  bind: (rules) =>
    withCustomGames(
      {
        id: 'turn-game-session',
        commandRouters: [],
        eventRouters: [],
        recoverEffects: () => [],
        matchRooms: [matchRoomModule],
      },
      rules
    ),
};

/**
 * A turn game as the registry lists it and every shared suite plays it.
 * Only {@link defineTurnGame} makes one: its private brand is not copied by
 * a spread or met by a hand-built object, so a registered turn game always
 * has its shared sessions installed and its contract checked — at type
 * checking, and at registration ({@link assertTurnGameDefinitions}).
 */
class DefinedTurnGame<C extends TurnGameCapabilities = TurnGameCapabilities>
  implements GameDefinition
{
  readonly #defined = true;
  readonly id: string;
  /** What the game offers, as declared: its client's parts follow it. */
  readonly capabilities: C;
  readonly turnGame: RegisteredTurnGame;
  readonly automation: GameAutomation<Driver>;
  readonly sharedModules: readonly SharedGameModule[];
  readonly commandRouters: GameOwnRoom['commandRouters'];
  readonly eventRouters: GameOwnRoom['eventRouters'];
  declare readonly initialState?: () => RoomState;
  readonly recoverEffects = () => [];

  constructor(game: TurnGame<C>, turnGame: RegisteredTurnGame) {
    this.id = game.rules.id;
    this.capabilities = game.capabilities;
    this.turnGame = turnGame;
    this.automation = { rules: game.rules, ...game.automation };
    // Puzzles are offered through the one puzzle session every space installs.
    this.sharedModules =
      game.capabilities.puzzles === undefined
        ? [TURN_GAME_SESSIONS]
        : [TURN_GAME_SESSIONS, PUZZLE_SESSIONS];
    this.commandRouters = game.own?.commandRouters ?? [];
    this.eventRouters = game.own?.eventRouters ?? [];
    if (game.own?.initialState !== undefined)
      this.initialState = game.own.initialState;
  }

  /** Whether `value` was made by {@link defineTurnGame}. */
  static made(value: unknown): value is DefinedTurnGame {
    return typeof value === 'object' && value !== null && #defined in value;
  }
}

export type TurnGameDefinition<
  C extends TurnGameCapabilities = TurnGameCapabilities,
> = DefinedTurnGame<C>;

/** Everything a turn game supplies to the platform's shared lifecycles. */
export type TurnGame<C extends TurnGameCapabilities = TurnGameCapabilities> =
  Pick<RegisteredTurnGame, 'unprefixedNamespace'> & {
    /** The game's mechanics; its `id` is the game's wire id. */
    readonly rules: GameRules;
    /** What the platform offers for the game, each with what it needs. */
    readonly capabilities: C;
    /**
     * How a synthetic user and every shared suite choose an action and play it
     * on the game's board (`perform(ui, board, action)`).
     */
    readonly automation: Omit<GameAutomation<Driver>, 'rules'>;
    /** Room behaviour of the game's own screens, beside the shared ones. */
    readonly own?: GameOwnRoom;
  };

/**
 * The one way a turn game joins the platform. The platform installs the
 * shared sessions, refuses an inconsistent game when it is defined, and
 * offers exactly the capabilities the game declares.
 */
export function defineTurnGame<C extends TurnGameCapabilities>(
  game: TurnGame<C>
): TurnGameDefinition<C> {
  const id = game.rules.id;
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(id))
    throw new Error(`game id "${id}" is not a lowercase slug`);
  assertTurnGameCapabilities(id, game.capabilities);
  const setups = game.rules.setup !== undefined;
  if (setups !== (game.automation.arrange !== undefined))
    throw new Error(
      setups
        ? `${id}: its sides prepare private setups (rules.setup) — give its automation arrange(ui, board, setup), the gesture that enters a setup on its setup board`
        : `${id}: automation.arrange is only for a game with private setups (rules.setup)`
    );
  const turnGame: RegisteredTurnGame = {
    rules: game.rules,
    capabilities: game.capabilities,
    // Compatibility ownership is granted explicitly and checked by composition.
    ...(game.unprefixedNamespace === true
      ? { unprefixedNamespace: true as const }
      : {}),
  };
  // Capability requirements, the clock namespace and the starting position.
  createTurnGames([turnGame]);
  return new DefinedTurnGame<C>(game, turnGame);
}

/**
 * Fail, naming the entry, when a registry lists a definition
 * {@link defineTurnGame} did not make (a copy, a hand-built object).
 */
export function assertTurnGameDefinitions(
  registry: string,
  definitions: readonly unknown[]
): void {
  for (const [index, definition] of definitions.entries()) {
    if (DefinedTurnGame.made(definition)) continue;
    const id =
      typeof definition === 'object' &&
      definition !== null &&
      'id' in definition
        ? String(definition.id)
        : '?';
    throw new Error(
      `${registry}[${String(index)}] (${id}) was not made by defineTurnGame — register the game's defineTurnGame(...) value itself, never a copy or a hand-built definition`
    );
  }
}
