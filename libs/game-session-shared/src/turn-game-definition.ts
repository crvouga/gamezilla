import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared/durable-names';
import { matchRoomModule } from '@libs/game-matchmaking-shared/match-room';
import type {
  GameDefinition,
  GameOwnRoom,
  SharedGameModule,
} from '@libs/spaces-shared/game';
import type { RoomState } from '@pkgs/room-root-shared/types';
import type { GameAutomation } from '@pkgs/turn-game-shared/game-automation';
import type { PuzzlesCapability } from '@pkgs/turn-game-shared/game-puzzles';
import type {
  GameRules,
  RegisteredTurnGame,
  TurnGameCapabilities,
} from '@pkgs/turn-game-shared/game-rules';
import {
  createTurnGames,
  GAME_CAPABILITIES,
} from '@pkgs/turn-game-shared/game-rules';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import { withCustomGames } from './custom-game-definition';

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
class DefinedTurnGame implements GameDefinition {
  readonly #defined = true;
  readonly id: string;
  readonly turnGame: RegisteredTurnGame;
  readonly automation: GameAutomation<Driver>;
  readonly sharedModules: readonly SharedGameModule[] = [TURN_GAME_SESSIONS];
  readonly commandRouters: GameOwnRoom['commandRouters'];
  readonly eventRouters: GameOwnRoom['eventRouters'];
  declare readonly initialState?: () => RoomState;
  readonly recoverEffects = () => [];

  constructor(game: TurnGame, turnGame: RegisteredTurnGame) {
    this.id = game.rules.id;
    this.turnGame = turnGame;
    this.automation = { rules: game.rules, ...game.automation };
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

export type TurnGameDefinition = DefinedTurnGame;

/** Everything a turn game supplies to the platform's shared lifecycles. */
export type TurnGame = {
  /** The game's mechanics; its `id` is the game's wire id. */
  readonly rules: GameRules;
  /** What the platform offers for the game, each with what it needs. */
  readonly capabilities: TurnGameCapabilities;
  /**
   * How a synthetic user and every shared suite choose an action and play it
   * on the game's board (`perform(ui, board, action)`).
   */
  readonly automation: Omit<GameAutomation<Driver>, 'rules'>;
  /** Room behaviour of the game's own screens, beside the shared ones. */
  readonly own?: GameOwnRoom;
};

/** Refuse capabilities the platform does not offer, and placeholders. */
function assertCapabilityKeys(id: string, capabilities: object): void {
  for (const [key, value] of Object.entries(capabilities)) {
    if (!(GAME_CAPABILITIES as readonly string[]).includes(key))
      throw new Error(
        `${id}: "${key}" is not a capability the platform offers (${GAME_CAPABILITIES.join(', ')})`
      );
    if (value === undefined || value === null)
      throw new Error(
        `${id}: capabilities.${key} is a placeholder — leave out a capability the game does not offer`
      );
  }
}

/** What puzzles need from the game, for what a type cannot see. */
function assertPuzzles(id: string, puzzles: PuzzlesCapability | undefined) {
  if (puzzles === undefined) return;
  const needs = {
    'content.validate': puzzles.content?.validate,
    marks: puzzles.marks,
    isCell: puzzles.isCell,
  };
  for (const [name, value] of Object.entries(needs))
    if (typeof value !== 'function')
      throw new Error(
        `${id}: offering puzzles needs capabilities.puzzles.${name} — the platform judges and shows a puzzle only through it`
      );
  if (typeof puzzles.namespace !== 'string')
    throw new Error(
      `${id}: offering puzzles needs capabilities.puzzles.namespace ("${id}/")`
    );
}

/**
 * The one way a turn game joins the platform. The platform installs the
 * shared sessions, refuses an inconsistent game when it is defined, and
 * offers exactly the capabilities the game declares.
 */
export function defineTurnGame(game: TurnGame): TurnGameDefinition {
  const id = game.rules.id;
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(id))
    throw new Error(`game id "${id}" is not a lowercase slug`);
  assertCapabilityKeys(id, game.capabilities);
  assertPuzzles(id, game.capabilities.puzzles);
  const difficulties = game.capabilities['custom-games']?.bots.difficulties;
  if (
    difficulties !== undefined &&
    new Set(difficulties).size !== difficulties.length
  )
    throw new Error(`${id}: a bot difficulty is offered twice`);
  const turnGame: RegisteredTurnGame = {
    rules: game.rules,
    capabilities: game.capabilities,
    // Its stored clock choices and puzzles predate namespaces
    // (GAME_PLATFORM_NAMESPACE).
    ...(id === GAME_PLATFORM_NAMESPACE
      ? { unprefixedNamespace: true as const }
      : {}),
  };
  // Capability requirements, the clock namespace and the starting position.
  createTurnGames([turnGame]);
  return new DefinedTurnGame(game, turnGame);
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
