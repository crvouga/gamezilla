/**
 * Moves on a puzzle board, for any game offering puzzles, made with the
 * game's own gesture (`automation.perform`) as a person makes them, and
 * chosen from the game's known puzzles — never asked of the platform: the
 * puzzle on the board is looked up among its game's known puzzles by id,
 * and its line, wrong move, refused move and opponent's move are the ones
 * its author wrote.
 */

import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { puzzleLineLayout } from '@pkgs/turn-game-shared/game-puzzles';
import type { HarnessGame } from './harness-game';
import { harnessGameOf } from './harness-game-of';
import type { PuzzleFixture, PuzzleFixtureMove } from './known-puzzles';
import {
  PUZZLE_BOARD,
  readPuzzleOnBoard,
  readPuzzleProbe,
  waitSolverMayMove,
} from './puzzle-screen';

const WAIT_MS = 15_000;
const POLL_MS = 250;

/** `game`'s known puzzles; a game offering none has no puzzle to name. */
export function knownPuzzlesOf(game: HarnessGame): readonly PuzzleFixture[] {
  const known = game.fixtures.puzzles;
  if (known === undefined) throw new Error(`${game.label} offers no puzzles`);
  return known;
}

/**
 * "The game's known puzzle": its first known puzzle of two solver moves.
 */
export function theKnownPuzzle(game: HarnessGame): PuzzleFixture {
  const puzzles = game.shared.turnGame.capabilities.puzzles;
  if (puzzles === undefined) throw new Error(`${game.label} offers no puzzles`);
  const layout = puzzleLineLayout(puzzles);
  const fixture = knownPuzzlesOf(game).find(
    (known) => known.record.line.length === layout.start + layout.solverStep + 1
  );
  if (fixture === undefined)
    throw new Error(`${game.label}: name a known puzzle of two solver moves`);
  return fixture;
}

/** `game`'s known puzzle `puzzleId`, or one of its more puzzles. */
export function knownPuzzle(
  game: HarnessGame,
  puzzleId: string
): PuzzleFixture {
  const fixture = [
    ...knownPuzzlesOf(game),
    ...(game.fixtures.morePuzzles ?? []),
  ].find((known) => known.record.id === puzzleId);
  if (fixture === undefined)
    throw new Error(`${game.label} names no known puzzle ${puzzleId}`);
  return fixture;
}

/** The known puzzle on the actor's board. */
async function knownPuzzleOnBoard(
  s: ProductHarness,
  actorId: string,
  game: HarnessGame
): Promise<PuzzleFixture> {
  const id = await readPuzzleOnBoard(s, actorId);
  if (id === null) throw new Error(`${actorId} has no puzzle on the board`);
  return knownPuzzle(game, id);
}

/** Perform `action` on the puzzle board with the game's own gesture. */
async function perform(
  s: ProductHarness,
  actorId: string,
  game: HarnessGame,
  action: string
): Promise<void> {
  await game.shared.automation.perform(
    await actorUi(s, actorId),
    PUZZLE_BOARD,
    action
  );
  await s.session.waitForIdle();
}

/**
 * Play the line's solver moves from where the board is until it shows move
 * `index` with the solver to move (the opponent's replies play by
 * themselves), or the puzzle is over.
 */
async function reachMove(
  s: ProductHarness,
  actorId: string,
  on: { readonly game: HarnessGame; readonly fixture: PuzzleFixture },
  index: number
): Promise<void> {
  const { game, fixture } = on;
  for (;;) {
    const now = await readPuzzleProbe(s, actorId);
    // Over, or wrong: no move of the line is the solver's to play now.
    if (now !== null && now.status !== 'solving' && now.status !== 'loading')
      return;
    const probe = await waitSolverMayMove(s, actorId);
    if (probe.solveIdx >= index) return;
    const action = fixture.record.line[probe.solveIdx];
    if (action === undefined)
      throw new Error(`${fixture.record.id} has no move ${probe.solveIdx}`);
    await perform(s, actorId, game, action);
    await pollUntil(
      s,
      async () => {
        const after = await readPuzzleProbe(s, actorId);
        if (after === null) return null;
        if (after.status !== 'solving') return true;
        return after.solveIdx > probe.solveIdx && after.interactive
          ? true
          : null;
      },
      { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'the next solver move' }
    );
  }
}

/** Reach `move`'s place in the line, then play it there. */
async function playFixtureMove(
  s: ProductHarness,
  actorId: string,
  gameId: string,
  pick: (fixture: PuzzleFixture) => PuzzleFixtureMove
): Promise<void> {
  const game = harnessGameOf(s, gameId);
  const fixture = await knownPuzzleOnBoard(s, actorId, game);
  const move = pick(fixture);
  await reachMove(s, actorId, { game, fixture }, move.at);
  await perform(s, actorId, game, move.action);
}

/** Solve the puzzle on the board: the rest of its line's solver moves. */
export const solveKnownPuzzle = scenarioAction({
  name: 'solveKnownPuzzle',
  act: async (s, actorId: string, gameId: string) => {
    const game = harnessGameOf(s, gameId);
    const fixture = await knownPuzzleOnBoard(s, actorId, game);
    const last = fixture.record.line.length - 1;
    await reachMove(s, actorId, { game, fixture }, last);
    await perform(s, actorId, game, fixture.record.line[last] ?? '');
    await pollUntil(
      s,
      async () =>
        (await readPuzzleProbe(s, actorId))?.status === 'solved' ? true : null,
      { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'the puzzle solved' }
    );
  },
});

/** Play the next move of the solution and wait until play can continue. */
export const playNextKnownMove = scenarioAction({
  name: 'playNextKnownMove',
  act: async (s, actorId: string, gameId: string) => {
    const game = harnessGameOf(s, gameId);
    const fixture = await knownPuzzleOnBoard(s, actorId, game);
    const { solveIdx } = await waitSolverMayMove(s, actorId);
    const puzzles = game.shared.turnGame.capabilities.puzzles;
    if (puzzles === undefined)
      throw new Error(`${game.label} offers no puzzles`);
    await reachMove(
      s,
      actorId,
      { game, fixture },
      solveIdx + puzzleLineLayout(puzzles).solverStep
    );
  },
});

/** Play the solver's next move of the line, without waiting for more. */
export const playSolutionMove = scenarioAction({
  name: 'playSolutionMove',
  act: async (s, actorId: string, gameId: string) => {
    const game = harnessGameOf(s, gameId);
    const fixture = await knownPuzzleOnBoard(s, actorId, game);
    const { solveIdx } = await waitSolverMayMove(s, actorId);
    await perform(s, actorId, game, fixture.record.line[solveIdx] ?? '');
  },
});

/** Play the known wrong move, where its author wrote it, and see it called. */
export const playKnownWrongMove = scenarioAction({
  name: 'playKnownWrongMove',
  act: async (s, actorId: string, gameId: string) => {
    await playFixtureMove(s, actorId, gameId, (fixture) => fixture.wrongMove);
    await pollUntil(
      s,
      async () =>
        (await readPuzzleProbe(s, actorId))?.status === 'wrong' ? true : null,
      { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'the move called wrong' }
    );
  },
});

/** Bring the line to where the puzzle's refused move would be played. */
export const reachKnownRefusedMove = scenarioAction({
  name: 'reachKnownRefusedMove',
  act: async (s, actorId: string, gameId: string) => {
    const game = harnessGameOf(s, gameId);
    const fixture = await knownPuzzleOnBoard(s, actorId, game);
    await reachMove(s, actorId, { game, fixture }, fixture.refusedMove.at);
  },
});

/** Try the move the game's rules do not allow there. */
export const tryKnownRefusedMove = scenarioAction({
  name: 'tryKnownRefusedMove',
  act: (s, actorId: string, gameId: string) =>
    playFixtureMove(s, actorId, gameId, (fixture) => fixture.refusedMove),
});

/** Bring the line to where the opponent's move would be tried. */
export const reachKnownOpponentMove = scenarioAction({
  name: 'reachKnownOpponentMove',
  act: async (s, actorId: string, gameId: string) => {
    const game = harnessGameOf(s, gameId);
    const fixture = await knownPuzzleOnBoard(s, actorId, game);
    await reachMove(
      s,
      actorId,
      { game, fixture },
      knownOpponentMove(fixture).at
    );
  },
});

/** Try a move for the opponent's side while the solver is to move. */
export const tryKnownOpponentMove = scenarioAction({
  name: 'tryKnownOpponentMove',
  act: (s, actorId: string, gameId: string) =>
    playFixtureMove(s, actorId, gameId, knownOpponentMove),
});

function knownOpponentMove(fixture: PuzzleFixture): PuzzleFixtureMove {
  if (fixture.opponentMove === undefined)
    throw new Error(`${fixture.record.id} has no opponent move`);
  return fixture.opponentMove;
}

/**
 * A wrong move wherever the solver is to move: the known wrong move there,
 * else a move the game's rules allow there that neither follows the line
 * nor wins.
 */
export const playWrongMoveHere = scenarioAction({
  name: 'playWrongMoveHere',
  act: async (s, actorId: string, gameId: string) => {
    const game = harnessGameOf(s, gameId);
    const fixture = await knownPuzzleOnBoard(s, actorId, game);
    const { solveIdx } = await waitSolverMayMove(s, actorId);
    const action =
      fixture.wrongMove.at === solveIdx
        ? fixture.wrongMove.action
        : wrongMoveAt(game, fixture, solveIdx);
    await perform(s, actorId, game, action);
    await pollUntil(
      s,
      async () =>
        (await readPuzzleProbe(s, actorId))?.status === 'wrong' ? true : null,
      { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'the move called wrong' }
    );
  },
});

/**
 * A watcher suggests a move on their board: one the rules allow where the
 * host's puzzle is, that is not the line's next move.
 */
export const suggestMoveToHost = scenarioAction({
  name: 'suggestMoveToHost',
  act: async (s, watcherId: string, gameId: string) => {
    const game = harnessGameOf(s, gameId);
    const fixture = await knownPuzzleOnBoard(s, watcherId, game);
    const probe = await readPuzzleProbe(s, watcherId);
    if (probe === null) throw new Error(`${watcherId} sees no puzzle`);
    await perform(
      s,
      watcherId,
      game,
      wrongMoveAt(game, fixture, probe.solveIdx)
    );
  },
});

/**
 * The known puzzle that can be won another way: the first whose author
 * wrote a winning move off its line.
 */
export function puzzleWonAnotherWay(game: HarnessGame): PuzzleFixture {
  const fixture = knownPuzzlesOf(game).find(
    (known) => known.wonAnotherWay !== undefined
  );
  if (fixture === undefined)
    throw new Error(`${game.label} names no known puzzle won another way`);
  return fixture;
}

/**
 * Win the puzzle on the board off its line: its author's other winning
 * move, played where they wrote it.
 */
export const winKnownPuzzleAnotherWay = scenarioAction({
  name: 'winKnownPuzzleAnotherWay',
  act: (s, actorId: string, gameId: string) =>
    playFixtureMove(s, actorId, gameId, (fixture) => {
      if (fixture.wonAnotherWay === undefined)
        throw new Error(`${fixture.record.id} is not won another way`);
      return fixture.wonAnotherWay;
    }),
});

/**
 * A move the rules allow at the line's `index` that is not right there: not
 * the line's move, no win, and no other way its author wrote to go on.
 */
export function wrongMoveAt(
  game: HarnessGame,
  fixture: PuzzleFixture,
  index: number
): string {
  const rules = game.shared.turnGame.rules;
  let position = fixture.record.position;
  for (const action of fixture.record.line.slice(0, index))
    position = rules.play(position, action, '', [])?.position ?? position;
  const right = [fixture.transposition, fixture.wonAnotherWay].flatMap(
    (move) => (move?.at === index ? [move.action] : [])
  );
  const wrong = [...rules.legal(position)]
    .sort()
    .find(
      (action) =>
        action !== fixture.record.line[index] &&
        !right.includes(action) &&
        rules.play(position, action, '', [])?.winner === null
    );
  if (wrong === undefined)
    throw new Error(`${fixture.record.id}: no wrong move at move ${index}`);
  return wrong;
}

export const PUZZLE_MOVE_ACTIONS = [
  solveKnownPuzzle,
  playNextKnownMove,
  playSolutionMove,
  playKnownWrongMove,
  reachKnownRefusedMove,
  tryKnownRefusedMove,
  reachKnownOpponentMove,
  tryKnownOpponentMove,
  playWrongMoveHere,
  suggestMoveToHost,
  winKnownPuzzleAnotherWay,
];
