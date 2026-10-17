import { matchRoomModule } from '@libs/game-matchmaking-shared/match-room';
import type {
  GameDefinition,
  GameOwnRoom,
  SharedGameModule,
} from '@libs/spaces-shared/game';
import type { GameAutomation } from '@pkgs/turn-game-shared/game-automation';
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

declare const DEFINED: unique symbol;

/**
 * A turn game as the registry lists it and every shared suite plays it.
 * Only {@link defineTurnGame} makes one, so a registered turn game always
 * has its shared sessions installed and its contract checked.
 */
export type TurnGameDefinition = GameDefinition & {
  readonly turnGame: RegisteredTurnGame;
  readonly automation: GameAutomation<Driver>;
  readonly [DEFINED]: true;
};

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

/**
 * The one way a turn game joins the platform. The platform installs the
 * shared sessions, refuses an inconsistent game when it is defined, and
 * offers exactly the capabilities the game declares.
 */
export function defineTurnGame(game: TurnGame): TurnGameDefinition {
  const id = game.rules.id;
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(id))
    throw new Error(`game id "${id}" is not a lowercase slug`);
  for (const key of Object.keys(game.capabilities))
    if (!(GAME_CAPABILITIES as readonly string[]).includes(key))
      throw new Error(
        `${id}: "${key}" is not a capability the platform offers`
      );
  const difficulties = game.capabilities['custom-games']?.bots.difficulties;
  if (
    difficulties !== undefined &&
    new Set(difficulties).size !== difficulties.length
  )
    throw new Error(`${id}: a bot difficulty is offered twice`);
  const turnGame: RegisteredTurnGame = {
    rules: game.rules,
    capabilities: game.capabilities,
  };
  createTurnGames([turnGame]);
  const definition = {
    id,
    turnGame,
    automation: { rules: game.rules, ...game.automation },
    sharedModules: [TURN_GAME_SESSIONS],
    commandRouters: game.own?.commandRouters ?? [],
    eventRouters: game.own?.eventRouters ?? [],
    ...(game.own?.initialState === undefined
      ? {}
      : { initialState: game.own.initialState }),
    recoverEffects: () => [],
  };
  return definition as typeof definition & { readonly [DEFINED]: true };
}
