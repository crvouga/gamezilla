import type { GameClientRegistration } from '@libs/game-menu-client-ts/game-client';
import { assertGameClientDefinitions } from '@libs/game-menu-client-ts/game-client';
import type { TurnGameDefinition } from '@libs/game-session-shared-ts/turn-game-definition';
import { assertTurnGameDefinitions } from '@libs/game-session-shared-ts/turn-game-definition';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { HarnessSlice } from '@libs/harness-ts/slices';
import type { CatalogAction } from '@pkgs/harness-root-shared-ts/effect';
import type {
  GameSetups,
  GameSide,
  TurnGameCapabilities,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  gameSides,
  offeredCapabilities,
  winningSides,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { KnownPuzzles, PuzzleFixture } from './known-puzzles';
import { assertKnownPuzzles, assertMorePuzzles } from './known-puzzles';
import {
  type KnownDeal,
  playedRulesOf,
  recordedLine,
  scriptedRandom,
} from './played-rules';

/**
 * Known examples of a game's rules, written by the game's author from the
 * game's own laws — never computed from its implementation — so a faulty
 * rules implementation fails the shared suites instead of agreeing with
 * itself.
 */
type RulesFixtures = {
  /**
   * Actions from the starting position, after which the first side
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
  /**
   * Only for a game of four seats whose rules let sides share a victory:
   * lines from the start, each ending on the fourth side's move, after which
   * the first and third sides share the victory (`shared`) or the third side
   * wins alone (`alone`). The shared-victory feature needs them.
   */
  readonly sharedVictories?: {
    readonly shared: readonly string[];
    readonly alone: readonly string[];
  };
  /**
   * Exactly for a game with private setups: one complete setup for each
   * side, as the game writes it. Every line above is then the proposals
   * people make, which the authority resolves against these setups — the
   * shared suites play them so, and a person readies with their side's.
   */
  readonly setups?: GameSetups;
  /**
   * Exactly for a game with dealt hands: the deal the shared suites start
   * every game from. The room's random source is made to return its
   * `draws` as a game starts, so the real authority deals `hidden`; every
   * line above is then the proposals people make with the hands it deals.
   */
  readonly knownDeal?: KnownDeal;
};

/**
 * The game's known puzzles, exactly when its definition offers puzzles: the
 * shared puzzle suites (`conformance/puzzles`) and laws (`game-puzzle-laws`)
 * need them, and nothing else may name one.
 */
export type PuzzleFixtureObligation<C> = 'puzzles' extends keyof C
  ? undefined extends C['puzzles' & keyof C]
    ? { readonly puzzles?: KnownPuzzles; readonly morePuzzles?: MorePuzzles }
    : { readonly puzzles: KnownPuzzles; readonly morePuzzles?: MorePuzzles }
  : { readonly puzzles?: never; readonly morePuzzles?: never };

/**
 * Further puzzles of a game offering puzzles, written by its author like
 * its known puzzles but kept out of the catalogue until a scenario needs
 * many distinct puzzles at once (`stockMorePuzzles`: days of puzzles
 * played offline). The shared puzzle-offline-days feature needs at least
 * thirty.
 */
export type MorePuzzles = readonly PuzzleFixture[];

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
  /** All names in declared seat order; required by the laws of games with more than two seats. */
  readonly participants?: readonly string[];
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
 * What a puzzle sound is to the solver, whichever game plays it: a move on
 * the board (the solver's, a reply, a review step), the cue that a move
 * was right, a wrong move, the end of the line on the board, a solve, and
 * a rating change.
 */
export type PuzzleSoundKind =
  | 'move'
  | 'correct move'
  | 'wrong move'
  | 'end'
  | 'solved'
  | 'rating';

/** The puzzle sound kinds the shared specifications hear. */
export const HEARD_PUZZLE_SOUNDS: readonly PuzzleSoundKind[] = [
  'move',
  'correct move',
  'wrong move',
  'end',
];

/**
 * A registered game as the shared suites exercise it: the conformance
 * adapter its harness package exports. The games registry harness lists
 * every one, and a registered game without one fails the enrollment test.
 */
export type HarnessGame<C extends TurnGameCapabilities = TurnGameCapabilities> =
  PlayableGame<C> & {
    /** The same client definition production registers. */
    readonly client: GameClientRegistration<TurnGameDefinition>;
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
    /**
     * The sounds its puzzles and their reviews play, by the source the
     * app's audio plays (`createAudioPlayer(source)`), each as what it is to
     * the solver; a game offering puzzles names one for each kind the shared
     * puzzle-sound specifications hear ({@link HEARD_PUZZLE_SOUNDS}), and
     * no other game names any, which `assertHarnessGame` checks.
     */
    readonly puzzleSounds?: Readonly<Record<string, PuzzleSoundKind>>;
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
  assertKnownSetups(game, fail);
  assertKnownDeal(game, fail);
  const played = playedRulesOf(game);
  const { firstSideVictory, refusedOpenings } = game.fixtures;
  if (firstSideVictory.length < gameSides(rules).length)
    fail('the first-side victory needs a move by each side');
  if (refusedOpenings.length === 0)
    fail('name at least one opening its rules refuse');
  for (const action of refusedOpenings)
    if (played.play(played.initial(), action, '', []) !== null)
      fail(`the refused opening ${action} is accepted`);
  assertMoveNamesAndRecord(game, fail);
  const cannotWin = game.fixtures.secondSideCannotWin;
  if (cannotWin !== undefined) assertCannotWinLine(game, cannotWin, fail);
  const drawn = game.fixtures.drawByRules;
  if (drawn !== undefined) assertDrawingLine(game, drawn, fail);
  const shared = game.fixtures.sharedVictories;
  if (shared !== undefined) {
    assertVictoryLine(game, shared.shared, ['white', 'red'], fail);
    assertVictoryLine(game, shared.alone, ['red'], fail);
  }
  let position = played.initial();
  let history = '';
  const actions: string[] = [];
  for (const [index, action] of firstSideVictory.entries()) {
    const next = played.play(position, action, history, actions);
    if (next === null) fail(`victory move ${action} is refused`);
    const last = index === firstSideVictory.length - 1;
    if (last !== (next?.winner === 'white'))
      fail('the victory must be won by its last move, by the first side');
    if (next?.label !== game.fixtures.firstSideVictoryLabels[index])
      fail(
        `victory move ${action} is not written ${String(game.fixtures.firstSideVictoryLabels[index])}`
      );
    position = next!.position;
    history = next!.history;
    actions.push(action);
  }
  return game;
}

/**
 * A game with private setups names one complete setup for each side,
 * written as the game stores it; no other game names any.
 */
function assertKnownSetups(
  game: HarnessGame,
  fail: (problem: string) => void
): void {
  const setup = game.shared.turnGame.rules.setup;
  const known = game.fixtures.setups;
  if ((setup === undefined) !== (known === undefined))
    fail(
      setup === undefined
        ? 'only a game with private setups names known setups'
        : 'a game with private setups names one known setup for each side (fixtures.setups)'
    );
  if (setup === undefined || known === undefined) return;
  for (const side of gameSides(game.shared.turnGame.rules))
    if (known[side] === undefined || setup.accept(known[side]!) !== known[side])
      fail(
        `the known ${side} setup is not one complete setup as the game stores it`
      );
}

/**
 * A game with dealt hands names the deal its suites start from: its draws
 * deal exactly its hidden state, and the hands written beside the known
 * victory are the hands that deal gives; no other game names a deal.
 */
function assertKnownDeal(
  game: HarnessGame,
  fail: (problem: string) => void
): void {
  const rules = game.shared.turnGame.rules;
  const hands = rules.hands;
  const deal = game.fixtures.knownDeal;
  if ((hands === undefined) !== (deal === undefined))
    fail(
      hands === undefined
        ? 'only a game with dealt hands names a known deal'
        : 'a game with dealt hands names the deal its suites start from (fixtures.knownDeal)'
    );
  if (hands === undefined || deal === undefined) return;
  if (hands.deal(rules.initial(), scriptedRandom(deal.draws)) !== deal.hidden)
    fail('the known deal draws do not deal its hidden state');
  const written = deal.hands ?? [];
  const victory = game.fixtures.firstSideVictory;
  const played = playedRulesOf(game);
  for (const [ply, expected] of written.entries()) {
    const at = played.replay(victory, ply).split('\n');
    for (const [side, hand] of Object.entries(expected))
      if (hands.hand(at[1] ?? '', side as GameSide) !== hand)
        fail(`before victory move ${ply + 1} the ${side} hand is not ${hand}`);
  }
  if (recordedLine(game, victory).length !== victory.length)
    fail('the known victory is not playable from the known deal');
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
  const sounds = game.puzzleSounds;
  if (!offered && sounds !== undefined)
    fail('only a game offering puzzles names puzzle sounds');
  if (offered) {
    const named = new Set(Object.values(sounds ?? {}));
    const missing = HEARD_PUZZLE_SOUNDS.filter((kind) => !named.has(kind));
    if (missing.length > 0)
      fail(
        `a game offering puzzles names the sounds its puzzles play (puzzleSounds) — none is a ${missing.join(', ')} sound`
      );
  }
  const more = game.fixtures.morePuzzles;
  if (!offered && more !== undefined)
    fail('only a game offering puzzles names more puzzles');
  const puzzles = game.shared.turnGame.capabilities.puzzles;
  if (known !== undefined && puzzles !== undefined) {
    const facts = {
      rules: game.shared.turnGame.rules,
      puzzles,
    };
    assertKnownPuzzles(facts, known, fail);
    if (more !== undefined) assertMorePuzzles(facts, known, more, fail);
  }
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
  const rules = playedRulesOf(game);
  if ((line.length - 1) % gameSides(rules).length !== 0)
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
/**
 * A known line ending, on the fourth side's move, in a victory exactly
 * `winners` hold; nothing finishes the game before its last move.
 */
function assertVictoryLine(
  game: HarnessGame,
  line: readonly string[],
  winners: readonly GameSide[],
  fail: (problem: string) => void
): void {
  const rules = playedRulesOf(game);
  const sides = gameSides(game.shared.turnGame.rules);
  if (sides.length !== 4) fail('shared victories are named for four seats');
  let position = rules.initial();
  let history = '';
  let mover: GameSide = sides[0]!;
  const actions: string[] = [];
  for (const [index, action] of line.entries()) {
    const played = rules.play(position, action, history, actions);
    const last = index === line.length - 1;
    if (played === null || (played.winner !== null) !== last)
      return fail(`the known victory of ${winners.join(' and ')} stops at ${action}`);
    if (last) {
      if (mover !== sides[3])
        fail(`the known victory of ${winners.join(' and ')} is not won on the fourth side's move`);
      const won = winningSides(played.winner!, sides);
      if (won.join() !== winners.join())
        fail(`the known victory of ${winners.join(' and ')} goes to ${won.join(' and ')}`);
    }
    position = played.position;
    history = played.history;
    mover = played.turn;
    actions.push(action);
  }
}

function assertDrawingLine(
  game: HarnessGame,
  line: readonly string[],
  fail: (problem: string) => void
): void {
  const rules = playedRulesOf(game);
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
