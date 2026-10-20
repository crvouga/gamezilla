/**
 * A game's known puzzles: the examples its author writes from the game's
 * own laws for the shared puzzle suites, and the check that the game's
 * rules do not contradict them (run by `assertHarnessGame`). What the
 * platform makes of each — judging, playback, the session — is the shared
 * suites' and laws' business; here only the game's own rules are asked.
 */

import type { PuzzleGame } from '@libs/game-puzzle-shared/puzzle-setup';
import {
  type PuzzleRecord,
  type PuzzlesCapability,
  puzzleLineLayout,
} from '@pkgs/turn-game-shared/game-puzzles';
import type { GameSide } from '@pkgs/turn-game-shared/game-rules';

/**
 * A solver move of a known puzzle: the line is followed up to `at` (the
 * index of a solver move in `record.line` under its declared layout), and `action` is played
 * there instead of the line's move.
 */
export type PuzzleFixtureMove = {
  readonly at: number;
  readonly action: string;
};

/**
 * One known puzzle of the game, written by its author from the game's own
 * laws: what the platform's puzzle session must make of it.
 */
export type PuzzleFixture = {
  /** The stored puzzle, its id in the game's namespace. */
  readonly record: PuzzleRecord;
  /** The side the solver plays at the declared starting position. */
  readonly solverSide: GameSide;
  /** The solver's moves, including every entry of a solver-only line. */
  readonly solution: readonly string[];
  /** How the game's rules name each recorded action, in order. */
  readonly labels: readonly string[];
  /** A move its rules accept that neither follows the line nor wins: wrong. */
  readonly wrongMove: PuzzleFixtureMove;
  /** A move its rules refuse there: no move at all. */
  readonly refusedMove: PuzzleFixtureMove;
  /**
   * A move for the opponent's side while the solver is to move there,
   * made on the board as the game lets a person try one: its rules refuse
   * it, so it is no move at all.
   */
  readonly opponentMove?: PuzzleFixtureMove;
  /**
   * Only for a puzzle the game's rules let the solver win off the line: a
   * winning move other than the line's, which solves it at once.
   */
  readonly wonAnotherWay?: PuzzleFixtureMove;
  /**
   * Only for a puzzle whose solver moves may be swapped: the solver's
   * following line move played one turn early, reaching the same position
   * after the line's reply.
   */
  readonly transposition?: PuzzleFixtureMove;
};

/** At least one known puzzle. */
export type KnownPuzzles = readonly [PuzzleFixture, ...PuzzleFixture[]];

type Fail = (problem: string) => void;

/** The actions the person supplies, according to the declared line layout. */
export function solverMovesOf(
  line: readonly string[],
  puzzles: Pick<PuzzlesCapability, 'lineMode'>
): readonly string[] {
  const layout = puzzleLineLayout(puzzles);
  return line.filter(
    (_action, index) =>
      index >= layout.start && (index - layout.start) % layout.solverStep === 0
  );
}

/** Every fixture move of `fixture`, named for a failure. */
export function fixtureMovesOf(
  fixture: PuzzleFixture
): readonly (readonly [string, PuzzleFixtureMove])[] {
  const moves: (readonly [string, PuzzleFixtureMove | undefined])[] = [
    ['wrong move', fixture.wrongMove],
    ['refused move', fixture.refusedMove],
    ["opponent's move", fixture.opponentMove],
    ['win another way', fixture.wonAnotherWay],
    ['transposition', fixture.transposition],
  ];
  return moves.flatMap(([name, move]) =>
    move === undefined ? [] : [[name, move] as const]
  );
}

/** The fixture's shape alone: ids, namespace, solution, labels, indices. */
function assertShape(
  game: PuzzleGame,
  fixture: PuzzleFixture,
  fail: Fail
): void {
  const { id, line } = fixture.record;
  const { namespace } = game.puzzles;
  const layout = puzzleLineLayout(game.puzzles);
  const named =
    namespace === ''
      ? id !== '' && !id.includes('/')
      : id.startsWith(namespace) && id.length > namespace.length;
  if (!named)
    fail(`the known puzzle ${id} is not in the namespace "${namespace}"`);
  if (line.length <= layout.start)
    fail(
      `the known puzzle ${id} has no solver move${layout.start === 1 ? ' after its setup move' : ''}`
    );
  if (
    JSON.stringify(fixture.solution) !==
    JSON.stringify(solverMovesOf(line, game.puzzles))
  )
    fail(`the known puzzle ${id}'s solution is not its line's solver moves`);
  if (fixture.labels.length !== line.length)
    fail(
      `the known puzzle ${id} names ${fixture.labels.length} of its ${line.length} line moves`
    );
  if (layout.solverStep === 2 && fixture.opponentMove === undefined)
    fail(`the known puzzle ${id} has no opponent move`);
  if (layout.solverStep === 1 && fixture.opponentMove !== undefined)
    fail(`the known puzzle ${id} has an opponent move without an opponent`);
  for (const [name, move] of fixtureMovesOf(fixture))
    if (
      move.at < layout.start ||
      (move.at - layout.start) % layout.solverStep !== 0 ||
      move.at >= line.length
    )
      fail(
        `the known puzzle ${id}'s ${name} is not at a solver move of its line`
      );
}

/** The positions of the line, its starting position first, by the rules. */
function assertLine(
  game: PuzzleGame,
  fixture: PuzzleFixture,
  fail: Fail
): readonly string[] {
  const { id, line, position } = fixture.record;
  if (!game.rules.recognizes(position))
    fail(`the known puzzle ${id}'s position is not one of the game's`);
  const positions = [position];
  for (const [index, action] of line.entries()) {
    const played = game.rules.play(positions[index] ?? '', action, '', []);
    if (played === null) {
      fail(`the known puzzle ${id}'s line move ${action} is refused`);
      return positions;
    }
    if (played.label !== fixture.labels[index])
      fail(
        `the known puzzle ${id}'s line move ${action} is written ${played.label}, not ${String(fixture.labels[index])}`
      );
    if (index === 0 && played.turn !== fixture.solverSide)
      fail(
        `the known puzzle ${id}'s setup move gives ${played.turn} the turn, not ${fixture.solverSide}`
      );
    if (index < line.length - 1 && played.winner !== null)
      fail(`the known puzzle ${id}'s line ends the game at ${action}`);
    positions.push(played.position);
  }
  return positions;
}

/** Each fixture move as its rules take it: refused, accepted, winning. */
function assertMoves(
  game: PuzzleGame,
  fixture: PuzzleFixture,
  positions: readonly string[],
  fail: Fail
): void {
  const id = fixture.record.id;
  const play = (move: PuzzleFixtureMove) =>
    game.rules.play(positions[move.at] ?? '', move.action, '', []);
  if (play(fixture.refusedMove) !== null)
    fail(
      `the known puzzle ${id}'s refused move ${fixture.refusedMove.action} is accepted`
    );
  if (fixture.opponentMove !== undefined && play(fixture.opponentMove) !== null)
    fail(
      `the known puzzle ${id}'s opponent's move ${fixture.opponentMove.action} is accepted`
    );
  const wrong = play(fixture.wrongMove);
  if (wrong === null || wrong.winner === fixture.solverSide)
    fail(
      `the known puzzle ${id}'s wrong move ${fixture.wrongMove.action} is ${wrong === null ? 'refused' : 'a win'}`
    );
  const other = fixture.wonAnotherWay;
  if (other !== undefined && play(other)?.winner !== fixture.solverSide)
    fail(`the known puzzle ${id}'s other win ${other.action} does not win`);
  const swapped = fixture.transposition;
  if (swapped !== undefined && play(swapped) === null)
    fail(`the known puzzle ${id}'s transposition ${swapped.action} is refused`);
}

/**
 * Fail, naming the problem, on known puzzles the game's own rules
 * contradict or that leave the game's namespace.
 */
export function assertKnownPuzzles(
  game: PuzzleGame,
  known: KnownPuzzles,
  fail: Fail
): void {
  const ids = known.map((fixture) => fixture.record.id);
  if (new Set(ids).size !== ids.length) fail('two known puzzles share an id');
  if (!known.some((fixture) => fixture.solution.length >= 2))
    fail(
      'name a known puzzle of two solver moves or more (retrying and stepping through a line need one)'
    );
  for (const fixture of known) {
    assertShape(game, fixture, fail);
    assertMoves(game, fixture, assertLine(game, fixture, fail), fail);
  }
}

/**
 * Fail, naming the problem, on more puzzles of the game its rules
 * contradict, that leave its namespace, or that repeat a puzzle: each is
 * held to what a known puzzle is, and none shares an id or a position and
 * line with another, known or more.
 */
export function assertMorePuzzles(
  game: PuzzleGame,
  known: KnownPuzzles,
  more: readonly PuzzleFixture[],
  fail: Fail
): void {
  const all = [...known, ...more];
  const ids = all.map((fixture) => fixture.record.id);
  if (new Set(ids).size !== ids.length) fail('two puzzles share an id');
  const keys = all.map(
    ({ record }) => `${record.position} ${record.line.join(' ')}`
  );
  if (new Set(keys).size !== keys.length)
    fail('two puzzles share a position and line');
  for (const fixture of more) {
    assertShape(game, fixture, fail);
    assertMoves(game, fixture, assertLine(game, fixture, fail), fail);
  }
}
