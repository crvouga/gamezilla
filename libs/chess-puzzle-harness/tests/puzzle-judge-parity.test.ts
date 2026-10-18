/**
 * The platform's puzzle setup, replay and judge, run over chess's rules and
 * puzzles, decide every chess puzzle exactly as chess's own judge did: on
 * every fixture puzzle the harness seeds or ingests, at every solver move,
 * for every legal move and every spelling of one (king-onto-rook castling,
 * upper case, malformed), and on the judge's regression positions.
 */

import { expect, test } from 'bun:test';
import {
  HARNESS_CHESS_FIXTURES_DIR,
  HARNESS_CHESS_PUZZLES,
} from '@libs/chess-puzzle-harness/chess-puzzles';
import { HARNESS_CHESS_PUZZLES_WEB_CSV } from '@libs/chess-puzzle-harness/chess-puzzles-web-fixture';
import { INGEST_ROWS } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import {
  setupPuzzleStart,
  tokenize,
  uciToSquares,
} from '@libs/chess-puzzle-shared/chess-puzzle-fsm';
import type { PuzzleMoveJudgement as OldJudgement } from '@libs/chess-puzzle-shared/chess-puzzle-move-judge';
import { judgePuzzleMove } from '@libs/chess-puzzle-shared/chess-puzzle-move-judge';
import { fenAtSolveIdx } from '@libs/chess-puzzle-shared/chess-puzzle-step';
import {
  CHESS_PUZZLE_GAME,
  chessPuzzles,
} from '@libs/chess-puzzle-shared/chess-puzzles';
import type { PuzzleMoveJudgement } from '@libs/game-puzzle-shared/puzzle-judge';
import { judgePuzzleAction } from '@libs/game-puzzle-shared/puzzle-judge';
import { positionAt, setupPuzzle } from '@libs/game-puzzle-shared/puzzle-setup';
import { lineActions } from '@libs/game-puzzle-shared/step';
import { legalMoves } from '@pkgs/chess-rules-shared/moves';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

type Fixture = {
  readonly id: string;
  readonly fen: string;
  readonly moves: string;
};

/** `id`, `fen` and `moves` of every row (they precede every quoted column). */
function rowsOf(csv: string): readonly Fixture[] {
  const [header = '', ...rows] = csv.trim().split('\n');
  const columns = header.toLowerCase().split(',');
  const at = (name: string) => columns.findIndex((c) => c === name);
  const id = Math.max(at('id'), at('puzzleid'));
  const fen = at('fen');
  const moves = at('moves');
  return rows.map((row) => {
    const cells = row.split(',');
    return {
      id: cells[id] ?? '',
      fen: cells[fen] ?? '',
      moves: cells[moves] ?? '',
    };
  });
}

const fixtureFiles = [
  ...new Bun.Glob('*.harness.csv').scanSync(HARNESS_CHESS_FIXTURES_DIR),
].sort();
const FIXTURES: readonly Fixture[] = [
  ...(
    await Promise.all(
      fixtureFiles.map(async (file) =>
        rowsOf(await Bun.file(`${HARNESS_CHESS_FIXTURES_DIR}/${file}`).text())
      )
    )
  ).flat(),
  ...rowsOf(HARNESS_CHESS_PUZZLES_WEB_CSV),
  ...Object.values(INGEST_ROWS).flatMap((row) =>
    rowsOf(`PuzzleId,FEN,Moves\n${row.line}`)
  ),
];

/** The judge's own regression positions (`move-judge`, `mate-objective`). */
const REGRESSIONS: readonly Fixture[] = [
  {
    id: 'two-rooks',
    fen: '6k1/p6p/8/8/8/8/8/R3K2R b - - 0 1',
    moves: 'a7a6 a1a5 h7h6 h1h5',
  },
  {
    id: 'castling',
    fen: '4k3/p7/8/8/8/8/8/4K2R b K - 0 1',
    moves: 'a7a6 e1g1',
  },
  {
    id: 'underpromotion',
    fen: '2q5/4P1k1/8/8/8/8/8/6K1 b - - 0 1',
    moves: 'c8c7 e7e8n',
  },
  { id: 'ladder', fen: '7k/RR6/8/p7/8/8/8/6K1 b - - 0 1', moves: 'a5a4 b7b8' },
  {
    id: 'stored-mate-continues',
    fen: '7k/RR6/8/p7/8/8/8/6K1 b - - 0 1',
    moves: 'a5a4 b7b8 a4a3 b8c8',
  },
  {
    id: 'faster-mate',
    fen: '7k/RR6/8/p7/8/8/8/6K1 b - - 0 1',
    moves: 'a5a4 b7c7 a4a3 c7c8',
  },
];

/** Old and new verdicts in one vocabulary (`mate` is now a win). */
function oldShape(verdict: OldJudgement): PuzzleMoveJudgement {
  if (verdict.kind === 'illegal') return verdict;
  if (verdict.kind === 'wrong')
    return { kind: 'wrong', action: verdict.uci, label: verdict.san };
  return {
    kind: 'correct',
    via: verdict.via === 'mate' ? 'win' : verdict.via,
    action: verdict.uci,
    label: verdict.san,
    position: verdict.fen,
    line: verdict.line,
    ends: verdict.ends,
  };
}

/**
 * The spellings of an action a person or a stored line could send: the
 * line's own moves, castling as king-onto-rook, upper case, malformed text,
 * and the first `breadth` legal moves.
 */
function spellings(
  fen: string,
  extra: readonly string[],
  breadth: number
): readonly string[] {
  const moves = legalMoves(fen);
  const legal = moves.map((move) => move.uci);
  const castles = moves
    .filter((move) => move.isCastle)
    .map(
      (move) => `${move.from}${move.to > move.from ? 'h' : 'a'}${move.from[1]}`
    );
  return [
    ...legal.slice(0, breadth),
    ...extra,
    ...extra.map((uci) => uci.toUpperCase()),
    ...castles,
    'zz99',
    'e2',
    '',
  ];
}

/** Every solver step of a fixture: its index, position and side. */
function solverSteps(fixture: Fixture) {
  const tokens = tokenize(fixture.moves);
  const setup = setupPuzzleStart(fixture.fen, fixture.moves);
  if (setup.kind === 'invalid') return [];
  const steps = [];
  for (let idx = 1; idx < tokens.length; idx += 2) {
    const fen = fenAtSolveIdx({
      fen: fixture.fen,
      moves: fixture.moves,
      solveIdx: idx,
    });
    if (fen === null) break;
    steps.push({ idx, fen, tokens, side: setup.orientation });
  }
  return steps;
}

function expectSameVerdict(
  fixture: Fixture,
  step: ReturnType<typeof solverSteps>[number],
  uci: string
) {
  const old = judgePuzzleMove({
    fen: step.fen,
    tokens: step.tokens,
    idx: step.idx,
    uci,
  });
  const generic = judgePuzzleAction({
    game: CHESS_PUZZLE_GAME,
    position: step.fen,
    line: lineActions(fixture.moves),
    idx: step.idx,
    solverSide: step.side,
    action: uci,
  });
  expect({
    puzzle: fixture.id,
    idx: step.idx,
    uci,
    verdict: generic,
  }).toEqual({
    puzzle: fixture.id,
    idx: step.idx,
    uci,
    verdict: oldShape(old),
  });
}

test('the fixtures cover chess puzzles of both sides, castling, promotion and longer lines', () => {
  expect(FIXTURES.length).toBeGreaterThan(70);
  expect(
    HARNESS_CHESS_PUZZLES.every((puzzle) =>
      FIXTURES.some((f) => f.id === puzzle.id)
    )
  ).toBe(true);
});

test('setup and replay agree with chess’s own on every fixture puzzle', () => {
  for (const fixture of [...FIXTURES, ...REGRESSIONS]) {
    const old = setupPuzzleStart(fixture.fen, fixture.moves);
    const generic = setupPuzzle(
      CHESS_PUZZLE_GAME,
      fixture.fen,
      lineActions(fixture.moves)
    );
    expect({ id: fixture.id, setup: generic }).toEqual({
      id: fixture.id,
      setup:
        old.kind === 'invalid'
          ? old
          : {
              kind: 'ready',
              displayPosition: old.displayFen,
              solverSide: old.orientation,
              status: old.status,
            },
    });
    const length = tokenize(fixture.moves).length;
    for (let idx = 0; idx <= length + 1; idx += 1)
      expect({
        id: fixture.id,
        idx,
        at: positionAt(
          CHESS_PUZZLE_GAME,
          fixture.fen,
          lineActions(fixture.moves),
          idx
        ),
      }).toEqual({
        id: fixture.id,
        idx,
        at: fenAtSolveIdx({
          fen: fixture.fen,
          moves: fixture.moves,
          solveIdx: idx,
        }),
      });
    for (const action of tokenize(fixture.moves))
      expect(chessPuzzles.marks('', action)).toEqual(uciToSquares(action));
  }
}, 30_000);

test('the line, its spellings and the first legal moves at every solver step of every fixture puzzle are judged alike', () => {
  for (const fixture of FIXTURES)
    for (const step of solverSteps(fixture))
      for (const uci of spellings(step.fen, step.tokens.slice(step.idx), 6))
        expectSameVerdict(fixture, step, uci);
}, 30_000);

test('every legal move at every solver step of the judge’s regression positions is judged alike', () => {
  for (const fixture of REGRESSIONS)
    for (const step of solverSteps(fixture))
      for (const uci of spellings(
        step.fen,
        step.tokens.slice(step.idx),
        Number.POSITIVE_INFINITY
      ))
        expectSameVerdict(fixture, step, uci);
});

test('any action text at any solver step is judged alike', () => {
  const cases = [...FIXTURES, ...REGRESSIONS].flatMap((fixture) =>
    solverSteps(fixture).map((step) => ({ fixture, step }))
  );
  assertProperty(
    'the platform judge agrees with chess’s on any action text',
    fc.property(
      fc.nat({ max: cases.length - 1 }),
      fc.oneof(
        fc.nat({ max: 63 }).map((n) => `@legal:${String(n)}`),
        fc.stringMatching(/^[a-h][1-8][a-h][1-8][qrbnk]?$/),
        fc.string({ maxLength: 6 })
      ),
      (index, drawn) => {
        const { fixture, step } = cases[index]!;
        const legal = legalMoves(step.fen).map((move) => move.uci);
        const uci = drawn.startsWith('@legal:')
          ? (legal[Number(drawn.slice(7)) % Math.max(1, legal.length)] ?? '')
          : drawn;
        expectSameVerdict(fixture, step, uci);
      }
    )
  );
});
