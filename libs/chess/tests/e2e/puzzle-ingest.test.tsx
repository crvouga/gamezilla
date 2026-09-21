import { describe, expect, test } from 'bun:test';

import {
  type Puzzle,
  validateStoredPuzzleRow,
} from '@libs/chess/public/puzzle-data';
import {
  openPuzzleFromSpace,
  pressPuzzleNext,
  skipPuzzle,
} from '@libs/chess/sim/chess-actions';
import {
  ingestChessPuzzleCsv,
  readLocalPuzzles,
  readPuzzleBoardOrientation,
  readServerPuzzles,
  type StoredPuzzleRow,
} from '@libs/chess/sim/chess-puzzle-data';
import { readActivePuzzleId } from '@libs/chess/sim/chess-puzzle-ui';
import { createSpace } from '@libs/spaces/sim/space-actions';
import type { OpenSim } from './support/open-chess-sim';
import { openSim } from './support/open-chess-sim';

/** Ids of the Node sim fixture (`fixtures/chess-puzzles.sim.csv`). */
const SIM_FIXTURE_IDS = ['007hv', '01Xbe', '01zsb'];

const HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';

/**
 * Lichess-shaped ingest batch. Two valid puzzles — one White solves (Black to
 * move in the FEN), one Black solves — and one row per §23 rejection.
 */
const INGEST_CSV = [
  HEADER,
  // Valid: Black to move ⇒ White solves.
  'ingW1,6Qk/p1p3pp/4N3/1p6/2q1r1n1/2B5/PP4PP/3R1R1K b - - 0 28,h8g8 f1f8,1230,81,100,900,mate mateIn1 oneMove,https://lichess.org/TaT1Zl7z/black#56,',
  // Valid: White to move ⇒ Black solves.
  'ingB1,2kr1b1r/p1p2pp1/2pqb3/7p/3N2n1/2NPB3/PPP2PPP/R2Q1RK1 w - - 2 13,d4e6 d6h2,1240,95,100,800,kingsideAttack mate mateIn1,https://lichess.org/seIMDWkD#25,Scandinavian_Defense',
  // Illegal move in the line.
  'ingIllegal,6k1/5p1p/1p4p1/p1bN1p2/2Pq1P2/1P5P/1P1Q2P1/7K w - - 1 32,d2c3 g1g2,1250,90,100,50,mate,,',
  // Castling in the line, but the FEN has no castling right (§34).
  'ingCastle,r3k3/8/8/8/8/8/8/R3K2R b q - 0 1,a8b8 e1g1,1250,90,100,50,endgame,,',
  // Odd line: ends on the opponent's move.
  'ingOdd,8/3R3p/6pk/3p4/2p1b1P1/6KP/r7/4R3 w - - 0 41,g3h4 g6g5 h4g3,1250,90,100,50,endgame,,',
  // Bad FEN (seven ranks).
  'ingBadFen,8/8/8/8/8/8/8 w - - 0 1,e2e4 e7e5,1250,90,100,50,opening,,',
  // Same position + solution as sim fixture 007hv, other clocks, new id.
  'ingDup,6k1/5p1p/1p4p1/p1bN1p2/2Pq1P2/1P5P/1P1Q2P1/7K w - - 0 60,d2c3 d4g1,1250,90,100,50,mate,,',
].join('\n');

const VALID_INGESTED = ['ingB1', 'ingW1'];
const REJECTED = ['ingBadFen', 'ingCastle', 'ingDup', 'ingIllegal', 'ingOdd'];

function validated(row: StoredPuzzleRow): Puzzle {
  const result = validateStoredPuzzleRow(row);
  if (!result.ok) {
    throw new Error(`stored puzzle ${row.id} invalid: ${result.detail}`);
  }
  return result.puzzle;
}

/** Invariant: every stored row passes §23 and no position + line repeats. */
function expectAllValid(rows: readonly StoredPuzzleRow[]): Puzzle[] {
  const puzzles = rows.map(validated);
  const keys = new Set(puzzles.map((p) => p.positionKey));
  expect(keys.size).toBe(puzzles.length);
  return puzzles;
}

async function serverIds(s: OpenSim): Promise<string[]> {
  return (await s.read(readServerPuzzles)).map((row) => row.id);
}

/** Active puzzle + board orientation, checked against the synced row. */
async function checkActivePuzzle(s: OpenSim): Promise<'w' | 'b'> {
  const id = await s.read(readActivePuzzleId, 'alice');
  if (id === null) throw new Error('expected an active puzzle');
  const local = await s.read(readLocalPuzzles, 'alice');
  expectAllValid(local);
  const row = local.find((r) => r.id === id);
  if (row === undefined) throw new Error(`active puzzle ${id} not synced`);
  const puzzle = validated(row);
  const orientation = await s.read(readPuzzleBoardOrientation, 'alice');
  // §4: solver colour = inverted FEN side to move; the board faces the solver.
  expect(orientation).toBe(puzzle.solverColor === 'w' ? 'white' : 'black');
  return puzzle.solverColor;
}

describe('chess puzzle ingest (§4, §23)', () => {
  test('boot seeds only valid puzzles; ingest lands only the valid rows; the board faces the solver', async () => {
    await using s = await openSim('chess-puzzle-ingest');

    // Boot seeded the sim fixture through the real load-file seeder.
    expect(await serverIds(s)).toEqual(SIM_FIXTURE_IDS);
    expectAllValid(await s.read(readServerPuzzles));

    await s.apply(ingestChessPuzzleCsv, INGEST_CSV);
    const ids = await serverIds(s);
    expect(ids).toEqual([...SIM_FIXTURE_IDS, ...VALID_INGESTED].sort());
    for (const rejected of REJECTED) expect(ids).not.toContain(rejected);
    expectAllValid(await s.read(readServerPuzzles));

    // Re-ingesting the same file is a no-op (ids and positions dedupe).
    await s.apply(ingestChessPuzzleCsv, INGEST_CSV);
    expect(await serverIds(s)).toEqual(ids);

    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');
    const seen = new Set<'w' | 'b'>([await checkActivePuzzle(s)]);
    for (let step = 0; step < ids.length && seen.size < 2; step += 1) {
      await s.apply(skipPuzzle, 'alice');
      await s.apply(pressPuzzleNext, 'alice');
      seen.add(await checkActivePuzzle(s));
    }
    // Both a White-to-solve and a Black-to-solve puzzle were served.
    expect([...seen].sort()).toEqual(['b', 'w']);
  });
});
