import { PUZZLE_SESSIONS } from '@libs/game-puzzle-shared-ts/puzzle-sessions';
import type {
  GameDefinition,
  GameOwnRoom,
  SharedGameModule,
} from '@libs/spaces-shared-ts/game';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type {
  ContinuousAutomation,
  GameAutomation,
  TurnAutomation,
} from '@pkgs/turn-game-shared-ts/game-automation';
import type {
  GamePositionRules,
  GameRules,
  RegisteredGame,
  RegisteredTurnGame,
  TurnGameCapabilities,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  createTurnGames,
  isTurnRules,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import {
  assertPuzzleContent,
  type PuzzleContent,
} from '@pkgs/turn-game-shared-ts/puzzle-content';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { assertGameId } from './assert-game-id';
import { withCustomGames } from './custom-game-definition';
import {
  DefinedPuzzleGame,
  type PuzzleOnlyGame,
} from './puzzle-game-definition';
import { withSimulationCustomGames } from './simulation-custom-definition';
import { simulationMatchRoom } from './simulation-match-definition';
import { assertTurnGameCapabilities } from './turn-game-capabilities';

/** One shared product lifecycle, independently bound to each game's execution capabilities. */
const GAME_SESSIONS: SharedGameModule = {
  id: 'game-session',
  bind: (rules) =>
    withSimulationCustomGames(
      withCustomGames(
        {
          id: 'game-session',
          commandRouters: [],
          eventRouters: [],
          recoverEffects: () => [],
          matchRooms: [simulationMatchRoom(rules)],
        },
        rules
      ),
      rules
    ),
};

type GameParts<C extends TurnGameCapabilities> = Pick<
  RegisteredGame,
  'unprefixedNamespace'
> & {
  readonly rules: GamePositionRules;
  readonly capabilities: C;
  readonly own?: GameOwnRoom;
  readonly simulation?: RegisteredSimulation;
  readonly continuousAutomation?: Omit<
    ContinuousAutomation<Driver>,
    'parseInput'
  >;
  /** Authored content may coexist with multiplayer and the rated puzzle feed. */
  readonly puzzleContent?: PuzzleContent;
};

/** A discrete turn capability can coexist with a simulation on the same game identity. */
export type TurnGame<C extends TurnGameCapabilities = TurnGameCapabilities> =
  GameParts<C> & {
    readonly rules: GameRules;
    readonly turnAutomation: Omit<TurnAutomation<Driver>, 'rules'>;
  };
export type SimulationGame<
  C extends TurnGameCapabilities = TurnGameCapabilities,
> = GameParts<C> & {
  readonly simulation: RegisteredSimulation;
  readonly turnAutomation?: never;
};
export type Game<C extends TurnGameCapabilities = TurnGameCapabilities> =
  | TurnGame<C>
  | SimulationGame<C>;

class DefinedGame<C extends TurnGameCapabilities = TurnGameCapabilities>
  implements GameDefinition
{
  readonly #defined = true;
  readonly id: string;
  readonly capabilities: C;
  readonly registration: RegisteredGame;
  declare readonly turnGame?: RegisteredTurnGame;
  declare readonly automation?: GameAutomation<Driver>;
  declare readonly puzzleContent?: PuzzleContent;
  readonly sharedModules: readonly SharedGameModule[];
  readonly commandRouters: GameOwnRoom['commandRouters'];
  readonly eventRouters: GameOwnRoom['eventRouters'];
  declare readonly initialState?: () => RoomState;
  readonly recoverEffects = () => [];

  constructor(game: Game<C>, registration: RegisteredGame) {
    this.id = game.rules.id;
    this.capabilities = game.capabilities;
    this.registration = registration;
    if (isTurnRules(game.rules)) {
      this.turnGame = { ...registration, rules: game.rules };
    }
    if (game.puzzleContent !== undefined)
      this.puzzleContent = game.puzzleContent;
    const turns =
      isTurnRules(game.rules) && game.turnAutomation !== undefined
        ? { rules: game.rules, ...game.turnAutomation }
        : undefined;
    const continuous =
      game.continuousAutomation === undefined
        ? undefined
        : {
            ...game.continuousAutomation,
            parseInput: game.simulation!.parseInput,
          };
    if (turns !== undefined || continuous !== undefined)
      this.automation = {
        rules: game.rules,
        ...(turns === undefined ? {} : { turns }),
        ...(continuous === undefined ? {} : { continuous }),
      };
    // Puzzles are offered through the one puzzle session every space installs.
    this.sharedModules =
      game.capabilities.puzzles === undefined
        ? [GAME_SESSIONS]
        : [GAME_SESSIONS, PUZZLE_SESSIONS];
    this.commandRouters = game.own?.commandRouters ?? [];
    this.eventRouters = game.own?.eventRouters ?? [];
    if (game.own?.initialState !== undefined)
      this.initialState = game.own.initialState;
  }

  static made(value: unknown): value is DefinedGame {
    return typeof value === 'object' && value !== null && #defined in value;
  }
}

/** A game with position rules: turns, a simulation, or both. */
export type GameRegistration<
  C extends TurnGameCapabilities = TurnGameCapabilities,
> = DefinedGame<C>;
export type PuzzleGameDefinition = DefinedPuzzleGame;
/** One registry composes standalone puzzles and rule-bearing games, including games offering both. */
export type AnyGameRegistration = GameRegistration | PuzzleGameDefinition;
/** The stronger contract shared turn suites require; a continuous game supplies no fake turns. */
export type TurnGameDefinition<
  C extends TurnGameCapabilities = TurnGameCapabilities,
> = DefinedGame<C> & {
  readonly turnGame: RegisteredTurnGame;
  readonly automation: GameAutomation<Driver> & {
    readonly turns: TurnAutomation<Driver>;
  };
};

function assertSimulation(
  id: string,
  rules: GamePositionRules,
  simulation: RegisteredSimulation
): void {
  const state = simulation.initialize('registration');
  const encoded = simulation.codec.encode(state);
  if (!rules.recognizes(encoded) || simulation.codec.decode(encoded) === null)
    throw new Error(
      `${id}: simulation initialization must produce a recognized, serializable position`
    );
}

function assertParts<C extends TurnGameCapabilities>(game: Game<C>): void {
  const id = game.rules.id;
  assertGameId(id);
  if (game.puzzleContent !== undefined)
    assertPuzzleContent(id, game.puzzleContent);
  assertTurnGameCapabilities(id, game.capabilities, game.simulation);
  if (!isTurnRules(game.rules) && game.simulation === undefined)
    throw new Error(`${id}: supply turn rules or a simulation capability`);
  if (isTurnRules(game.rules) && game.turnAutomation === undefined)
    throw new Error(`${id}: turn rules require board automation`);
  if (
    game.continuousAutomation !== undefined &&
    (game.simulation === undefined ||
      !Number.isFinite(game.continuousAutomation.intervalMs) ||
      game.continuousAutomation.intervalMs <= 0)
  )
    throw new Error(
      `${id}: continuous automation requires a simulation and a positive interval`
    );
  const setups = game.rules.setup !== undefined;
  if (setups !== (game.turnAutomation?.arrange !== undefined))
    throw new Error(
      setups
        ? `${id}: its sides prepare private setups (rules.setup) — give its turnAutomation.arrange(ui, board, setup), the gesture that enters a setup on its setup board`
        : `${id}: turnAutomation.arrange is only for a game with private setups (rules.setup)`
    );
  if (game.simulation !== undefined)
    assertSimulation(id, game.rules, game.simulation);
}

/** Register one game with its product capabilities and optional execution parts. */
export function defineGame(game: PuzzleOnlyGame): PuzzleGameDefinition;
export function defineGame<C extends TurnGameCapabilities>(
  game: TurnGame<C> & { readonly puzzleContent: PuzzleContent }
): TurnGameDefinition<C> & { readonly puzzleContent: PuzzleContent };
export function defineGame<C extends TurnGameCapabilities>(
  game: TurnGame<C> & { readonly puzzleContent?: never }
): TurnGameDefinition<C> & { readonly puzzleContent?: never };
export function defineGame<C extends TurnGameCapabilities>(
  game: TurnGame<C>
): TurnGameDefinition<C>;
export function defineGame<C extends TurnGameCapabilities>(
  game: SimulationGame<C>
): GameRegistration<C>;
export function defineGame<C extends TurnGameCapabilities>(
  game: Game<C>
): GameRegistration<C>;
export function defineGame<C extends TurnGameCapabilities>(
  game: Game<C> | PuzzleOnlyGame
): GameRegistration<C> | PuzzleGameDefinition {
  if (game.rules === undefined) {
    assertGameId(game.id);
    assertPuzzleContent(game.id, game.puzzleContent);
    return new DefinedPuzzleGame(game);
  }
  assertParts(game);
  const registration: RegisteredGame = {
    rules: game.rules,
    capabilities: game.capabilities,
    ...(game.simulation === undefined ? {} : { simulation: game.simulation }),
    ...(game.unprefixedNamespace === true
      ? { unprefixedNamespace: true as const }
      : {}),
  };
  createTurnGames([registration]);
  return new DefinedGame(game, registration);
}

export function isGameRegistration(value: unknown): value is GameRegistration {
  return DefinedGame.made(value);
}

export function assertGameDefinitions(
  registry: string,
  definitions: readonly unknown[]
): void {
  for (const [index, definition] of definitions.entries()) {
    if (DefinedGame.made(definition) || DefinedPuzzleGame.made(definition))
      continue;
    const id =
      typeof definition === 'object' &&
      definition !== null &&
      'id' in definition
        ? String(definition.id)
        : '?';
    throw new Error(
      `${registry}[${String(index)}] (${id}) was not made by defineGame — register the game's defineGame(...) value itself, never a copy or a hand-built definition`
    );
  }
}
