import type { TurnGameDefinition } from '@libs/game-session-shared/turn-game-definition';
import type { ProductHarness } from '@libs/harness/harness';
import type { HarnessSlice } from '@libs/harness/slices';
import type { GameClientDefinition } from '@libs/spaces-shared/game';
import type { CatalogAction } from '@pkgs/harness-root-shared/effect';

/**
 * Known examples of a game's rules, written by the game's author from the
 * game's own laws — never computed from its implementation — so a faulty
 * rules implementation fails the shared suites instead of agreeing with
 * itself.
 */
export type GameFixtures = {
  /**
   * Actions, alternating from the first side, after which the first side
   * has won; only the last one wins.
   */
  readonly firstSideVictory: readonly string[];
  /**
   * Actions the rules must refuse from the starting position (an illegal
   * action, a malformed one); at least one.
   */
  readonly refusedOpenings: readonly string[];
};

/**
 * A registered game as the shared suites exercise it: the conformance
 * adapter its harness package exports. The games registry harness lists
 * every one, and a registered game without one fails the enrollment test.
 */
export type HarnessGame = {
  /** How failures and reports name the game ("chess", "Connect Four"). */
  readonly label: string;
  /** The same shared definition production registers. */
  readonly shared: TurnGameDefinition;
  /** The same client definition production registers. */
  readonly client: GameClientDefinition;
  /** The sub only this game's screens need, beside the shared ones. */
  readonly slice?: HarnessSlice;
  /** This game's own testing-tool actions. */
  readonly actions?: readonly CatalogAction<ProductHarness>[];
  readonly fixtures: GameFixtures;
};

/** Fail fast, naming the game, on an adapter its own rules contradict. */
export function assertHarnessGame(game: HarnessGame): HarnessGame {
  const rules = game.shared.turnGame.rules;
  const fail = (problem: string) => {
    throw new Error(`${game.label}: ${problem}`);
  };
  if (game.shared.id !== game.client.id || game.shared.id !== rules.id)
    fail('shared, client and rules ids differ');
  const { firstSideVictory, refusedOpenings } = game.fixtures;
  if (firstSideVictory.length < 2)
    fail('the first-side victory needs a move by each side');
  if (refusedOpenings.length === 0)
    fail('name at least one opening its rules refuse');
  for (const action of refusedOpenings)
    if (rules.play(rules.initial(), action, '', []) !== null)
      fail(`the refused opening ${action} is accepted`);
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  for (const [index, action] of firstSideVictory.entries()) {
    const played = rules.play(position, action, history, actions);
    if (played === null) fail(`victory move ${action} is refused`);
    const last = index === firstSideVictory.length - 1;
    if (last !== (played?.winner === 'white'))
      fail('the victory must be won by its last move, by the first side');
    position = played!.position;
    history = played!.history;
    actions.push(action);
  }
  return game;
}
