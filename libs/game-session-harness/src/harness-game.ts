import type { ProductHarness } from '@libs/harness/harness';
import type { HarnessSlice } from '@libs/harness/slices';
import type {
  GameClientDefinition,
  GameDefinition,
} from '@libs/spaces-shared/game';
import type { CatalogAction } from '@pkgs/harness-root-shared/effect';
import type { GameAutomation } from '@pkgs/turn-game-shared/game-automation';
import type { RegisteredTurnGame } from '@pkgs/turn-game-shared/game-rules';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';

/**
 * A registered game as the shared suites exercise it. A game's harness
 * package exports exactly one; the games registry harness lists every one,
 * and a registered game without one fails the enrollment test.
 */
export type HarnessGame = {
  /** How failures name the game ("chess", "Connect Four"). */
  readonly label: string;
  /** The same shared definition production registers. */
  readonly shared: GameDefinition & {
    readonly turnGame: RegisteredTurnGame;
    readonly automation: GameAutomation<Driver>;
  };
  /** The same client definition production registers. */
  readonly client: GameClientDefinition;
  /** The sub only this game's screens need, beside the shared ones. */
  readonly slice?: HarnessSlice;
  /** This game's own testing-tool actions. */
  readonly actions?: readonly CatalogAction<ProductHarness>[];
  /**
   * Moves, alternating from the first side, after which the first side has
   * won; the last one is the winning move. Validated against the rules.
   */
  readonly firstSideVictory: readonly string[];
};

/** Fail fast on an adapter whose data its own rules refuse. */
export function assertHarnessGame(game: HarnessGame): HarnessGame {
  const rules = game.shared.turnGame.rules;
  if (game.shared.id !== game.client.id || game.shared.id !== rules.id)
    throw new Error(`${game.label}: shared, client and rules ids differ`);
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  for (const [index, action] of game.firstSideVictory.entries()) {
    const played = rules.play(position, action, history, actions);
    if (played === null)
      throw new Error(`${game.label}: victory move ${action} is illegal`);
    const last = index === game.firstSideVictory.length - 1;
    if (last !== (played.winner === 'white'))
      throw new Error(
        `${game.label}: the victory must be won by its last move, by the first side`
      );
    position = played.position;
    history = played.history;
    actions.push(action);
  }
  return game;
}
