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
  /**
   * Actions, alternating from the first side and ending with the first
   * side's move, after which the second side cannot win while the first
   * side still can, and nothing has finished the game — both after the
   * last action and before it. Absent for a game whose sides can always
   * win, which the rules laws check. The shared custom-game feature about a
   * side that cannot win (`custom-game-cannot-win`) needs it.
   */
  readonly secondSideCannotWin?: readonly string[];
};

/**
 * What any driver needs to play a game — its name, its shared definition and
 * its known examples — without its screens, so a journey or a synthetic user
 * playing it loads no client code.
 */
export type PlayableGame = {
  /** How failures and reports name the game ("chess", "Connect Four"). */
  readonly label: string;
  /** The same shared definition production registers. */
  readonly shared: TurnGameDefinition;
  readonly fixtures: GameFixtures;
};

/**
 * A registered game as the shared suites exercise it: the conformance
 * adapter its harness package exports. The games registry harness lists
 * every one, and a registered game without one fails the enrollment test.
 */
export type HarnessGame = PlayableGame & {
  /** The same client definition production registers. */
  readonly client: GameClientDefinition;
  /** The sub only this game's screens need, beside the shared ones. */
  readonly slice?: HarnessSlice;
  /** This game's own testing-tool actions. */
  readonly actions?: readonly CatalogAction<ProductHarness>[];
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
  const cannotWin = game.fixtures.secondSideCannotWin;
  if (cannotWin !== undefined) assertCannotWinLine(game, cannotWin, fail);
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

/**
 * The known line after which the second side cannot win: legal, unfinished,
 * ending with the first side's move, and leaving the second side unable to
 * win (the first side able to) before and after that move.
 */
function assertCannotWinLine(
  game: HarnessGame,
  line: readonly string[],
  fail: (problem: string) => void
): void {
  const rules = game.shared.turnGame.rules;
  if (line.length % 2 === 0)
    fail(
      'the line where the second side cannot win must end with the first side'
    );
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  for (const action of line) {
    const played = rules.play(position, action, history, actions);
    if (played === null || played.winner !== null)
      fail(`the line where the second side cannot win stops at ${action}`);
    position = played!.position;
    history = played!.history;
    actions.push(action);
  }
  for (const ply of [line.length - 1, line.length]) {
    const at = rules.replay(line, ply);
    if (rules.canWin(at, 'black') || !rules.canWin(at, 'white'))
      fail(
        `after ${String(ply)} moves the second side can win, or the first cannot`
      );
  }
}
