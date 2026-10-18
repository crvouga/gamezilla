import type { GameClientRegistration } from '@libs/game-menu-client/game-client';
import { assertGameClientDefinitions } from '@libs/game-menu-client/game-client';
import type { TurnGameDefinition } from '@libs/game-session-shared/turn-game-definition';
import { assertTurnGameDefinitions } from '@libs/game-session-shared/turn-game-definition';
import type { ProductHarness } from '@libs/harness/harness';
import type { HarnessSlice } from '@libs/harness/slices';
import type { CatalogAction } from '@pkgs/harness-root-shared/effect';
import type {
  GameSide,
  TurnGameCapabilities,
} from '@pkgs/turn-game-shared/game-rules';
import { offeredCapabilities } from '@pkgs/turn-game-shared/game-rules';
import type { KnownPuzzles } from './known-puzzles';
import { assertKnownPuzzles } from './known-puzzles';

/**
 * Known examples of a game's rules, written by the game's author from the
 * game's own laws — never computed from its implementation — so a faulty
 * rules implementation fails the shared suites instead of agreeing with
 * itself.
 */
type RulesFixtures = {
  /**
   * Actions, alternating from the first side, after which the first side
   * has won; only the last one wins.
   */
  readonly firstSideVictory: readonly string[];
  /**
   * How the game writes each action of `firstSideVictory`, in order, in its
   * move list and its game record (chess: algebraic notation). The shared
   * matched-game features showing the moves played or a copied game record
   * (`matched-game-watchers`, `matched-game-review`, `matched-game-record`)
   * need it.
   */
  readonly firstSideVictoryLabels: readonly string[];
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
  /**
   * Actions, alternating from the first side, after which the game's own
   * rules have drawn it; only the last one draws, and nothing finishes the
   * game before it. Absent for a game its rules never draw, which the rules
   * laws check. The shared matched-game feature about a draw by the game's
   * own rules (`matched-game-rules-draw`) needs it.
   */
  readonly drawByRules?: readonly string[];
};

/**
 * The game's known puzzles, exactly when its definition offers puzzles: the
 * shared puzzle suites (`conformance/puzzles`) and laws (`game-puzzle-laws`)
 * need them, and nothing else may name one.
 */
export type PuzzleFixtureObligation<C> = 'puzzles' extends keyof C
  ? undefined extends C['puzzles' & keyof C]
    ? { readonly puzzles?: KnownPuzzles }
    : { readonly puzzles: KnownPuzzles }
  : { readonly puzzles?: never };

/**
 * Known examples of a game, written by the game's author from the game's
 * own laws; its known puzzles exactly when its definition `C` offers
 * puzzles (a type error otherwise, and a refusal from `assertHarnessGame`).
 */
export type GameFixtures<
  C extends TurnGameCapabilities = TurnGameCapabilities,
> = RulesFixtures & PuzzleFixtureObligation<C>;

/**
 * A finished matched game's record (the game's `history.record`) as the
 * game's own format reads, without the game's code: the names it gives the
 * two sides, the result, the clock choice and every move as it writes them.
 */
export type ReadGameRecord = {
  readonly firstSide: string | null;
  readonly secondSide: string | null;
  readonly result: GameSide | 'draw' | null;
  /** As finding an opponent writes it, without the game's namespace: `5+0`, `3d`. */
  readonly clockChoice: string | null;
  readonly moves: readonly string[];
};

/**
 * What any driver needs to play a game — its name, its shared definition and
 * its known examples — without its screens, so a journey or a synthetic user
 * playing it loads no client code.
 */
export type PlayableGame<
  C extends TurnGameCapabilities = TurnGameCapabilities,
> = {
  /** How failures and reports name the game ("chess", "Connect Four"). */
  readonly label: string;
  /** The same shared definition production registers. */
  readonly shared: TurnGameDefinition<C>;
  readonly fixtures: GameFixtures<C>;
};

/**
 * A registered game as the shared suites exercise it: the conformance
 * adapter its harness package exports. The games registry harness lists
 * every one, and a registered game without one fails the enrollment test.
 */
export type HarnessGame<C extends TurnGameCapabilities = TurnGameCapabilities> =
  PlayableGame<C> & {
    /** The same client definition production registers. */
    readonly client: GameClientRegistration;
    /** The sub only this game's screens need, beside the shared ones. */
    readonly slice?: HarnessSlice;
    /** This game's own testing-tool actions. */
    readonly actions?: readonly CatalogAction<ProductHarness>[];
    /**
     * Reads the game's record back in its own format, for a game offering
     * finding an opponent and history (whose matched games offer a game
     * record); absent otherwise, which `assertHarnessGame` checks. The shared
     * game-record feature (`matched-game-record`) needs it.
     */
    readonly readRecord?: (record: string) => ReadGameRecord;
  };

/**
 * Fail fast, naming the game, on an adapter its own rules contradict. Its
 * fixtures follow what its definition offers (`C`): known puzzles exactly
 * for a game offering puzzles.
 */
export function assertHarnessGame<C extends TurnGameCapabilities>(
  harnessGame: HarnessGame<C>
): HarnessGame {
  const game: HarnessGame = harnessGame;
  const rules = game.shared.turnGame.rules;
  const fail = (problem: string) => {
    throw new Error(`${game.label}: ${problem}`);
  };
  assertTurnGameDefinitions(`${game.label}: shared`, [game.shared]);
  assertGameClientDefinitions(`${game.label}: client`, [game.client]);
  if (game.shared.id !== game.client.id || game.shared.id !== rules.id)
    fail(
      `its definitions name different games (defineTurnGame "${game.shared.id}", defineGameClient "${game.client.id}", rules "${rules.id}") — give defineGameClient this game's defineTurnGame value as its shared`
    );
  assertPuzzlesAgree(game, fail);
  const { firstSideVictory, refusedOpenings } = game.fixtures;
  if (firstSideVictory.length < 2)
    fail('the first-side victory needs a move by each side');
  if (refusedOpenings.length === 0)
    fail('name at least one opening its rules refuse');
  for (const action of refusedOpenings)
    if (rules.play(rules.initial(), action, '', []) !== null)
      fail(`the refused opening ${action} is accepted`);
  assertMoveNamesAndRecord(game, fail);
  const cannotWin = game.fixtures.secondSideCannotWin;
  if (cannotWin !== undefined) assertCannotWinLine(game, cannotWin, fail);
  const drawn = game.fixtures.drawByRules;
  if (drawn !== undefined) assertDrawingLine(game, drawn, fail);
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  for (const [index, action] of firstSideVictory.entries()) {
    const played = rules.play(position, action, history, actions);
    if (played === null) fail(`victory move ${action} is refused`);
    const last = index === firstSideVictory.length - 1;
    if (last !== (played?.winner === 'white'))
      fail('the victory must be won by its last move, by the first side');
    if (played?.label !== game.fixtures.firstSideVictoryLabels[index])
      fail(
        `victory move ${action} is not written ${String(game.fixtures.firstSideVictoryLabels[index])}`
      );
    position = played!.position;
    history = played!.history;
    actions.push(action);
  }
  return game;
}

/**
 * A game offering puzzles has a puzzles part in its client and known
 * puzzles among its fixtures, which its rules do not contradict; a game
 * offering none has neither.
 */
function assertPuzzlesAgree(
  game: HarnessGame,
  fail: (problem: string) => void
): void {
  const offered = offeredCapabilities(game.shared.turnGame).includes('puzzles');
  if (offered !== (game.client.puzzles !== undefined))
    fail(
      offered
        ? 'the game offers puzzles but its client has no puzzles part — give defineGameClient puzzles: { Board, … }'
        : 'its client has a puzzles part but the game offers no puzzles — make the client with this definition as its shared'
    );
  const known = game.fixtures.puzzles;
  if (offered !== (known !== undefined))
    fail(
      known === undefined
        ? 'a game offering puzzles names known puzzles of its own (fixtures.puzzles)'
        : 'only a game offering puzzles names known puzzles'
    );
  const puzzles = game.shared.turnGame.capabilities.puzzles;
  if (known !== undefined && puzzles !== undefined)
    assertKnownPuzzles(
      { rules: game.shared.turnGame.rules, namespace: puzzles.namespace },
      known,
      fail
    );
}

/**
 * Every move of the victory is named, and exactly a game whose matched
 * games offer a game record (finding an opponent and history) reads it.
 */
function assertMoveNamesAndRecord(
  game: HarnessGame,
  fail: (problem: string) => void
): void {
  const { firstSideVictory, firstSideVictoryLabels } = game.fixtures;
  if (firstSideVictoryLabels.length !== firstSideVictory.length)
    fail('name every move of the first-side victory');
  const offered = offeredCapabilities(game.shared.turnGame);
  const recorded =
    offered.includes('matchmaking') && offered.includes('history');
  if (recorded !== (game.readRecord !== undefined))
    fail(
      recorded
        ? 'a game whose matched games offer a game record reads it back'
        : 'only a game whose matched games offer a game record reads one'
    );
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

/**
 * The known line the game's rules draw: legal, unfinished until its last
 * action, which draws the game.
 */
function assertDrawingLine(
  game: HarnessGame,
  line: readonly string[],
  fail: (problem: string) => void
): void {
  const rules = game.shared.turnGame.rules;
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  for (const [index, action] of line.entries()) {
    const played = rules.play(position, action, history, actions);
    const last = index === line.length - 1;
    if (played === null || played.winner !== (last ? 'draw' : null))
      fail(
        `the line its rules draw ${last ? 'does not draw' : 'stops'} at ${action}`
      );
    position = played!.position;
    history = played!.history;
    actions.push(action);
  }
}
