// @io-wall-ok — test fixture composition: repository files through the object-store port.
/**
 * The puzzles chess scenarios name, mapped to the fixtures the harness seeds or
 * the steps ingest (`libs/chess-puzzle-harness-ts/fixtures/*.harness.csv`). No step definitions.
 */

import type { ChessPuzzleTheme } from '@libs/chess-puzzle-shared-ts/chess-puzzle-themes';
import { ObjectStoreImplNodeFs } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import {
  HARNESS_CHESS_FIXTURES_DIR,
  HARNESS_CHESS_PUZZLE_IDS,
  HARNESS_CHESS_PUZZLE_MATE_IN_2,
} from './chess-puzzles';
import { HARNESS_CHESS_FEED_POOL_IDS } from './seed-harness-chess-puzzles';

const fixtureStore = new ObjectStoreImplNodeFs({
  rootDir: HARNESS_CHESS_FIXTURES_DIR,
  fs: wallNodeFs(),
  layout: 'tree',
});
async function fixtureCsv(name: string): Promise<string> {
  const text = await readUtf8(fixtureStore, name);
  if (text === null) throw new Error(`Missing chess fixture: ${name}`);
  return text;
}

/** The three puzzles every chess harness seeds at boot, in id order. */
export const STANDARD_PUZZLE_IDS: readonly string[] = [
  ...HARNESS_CHESS_PUZZLE_IDS,
].sort();

/** The feed-sized pool the scenarios' world seeds beside the three. */
export const FEED_POOL_IDS: readonly string[] = HARNESS_CHESS_FEED_POOL_IDS;

/** Fourteen puzzles clustered on the 1500 seed rating. */
export const RATING_CSV = await fixtureCsv('chess-puzzles-rating.harness.csv');

/** One puzzle per motif, each with a theme no other seeded puzzle carries. */
export const MOTIF_CSV = await fixtureCsv('chess-puzzles-motifs.harness.csv');

export type NamedPuzzle = {
  readonly id: string;
  readonly theme: ChessPuzzleTheme;
  /** Ingested before it is served; the standard puzzles are seeded at boot. */
  readonly csv: string | null;
};

export const NAMED_PUZZLES = {
  underpromotion: { id: 'solveUP1', theme: 'underPromotion', csv: MOTIF_CSV },
  capturePromotion: { id: 'solveCAP1', theme: 'promotion', csv: MOTIF_CSV },
  enPassant: { id: 'solveEP1', theme: 'enPassant', csv: MOTIF_CSV },
  castling: { id: 'solveCAS1', theme: 'castling', csv: MOTIF_CSV },
  moreThanOneMate: { id: 'solveMM1', theme: 'killBoxMate', csv: MOTIF_CSV },
  hookMate: { id: 'solveFM1', theme: 'hookMate', csv: MOTIF_CSV },
  twoRookClearance: { id: 'solveTR1', theme: 'clearance', csv: MOTIF_CSV },
  blackPromotes: { id: 'solveBP1', theme: 'advancedPawn', csv: MOTIF_CSV },
  whiteInCheck: { id: 'solveCK1', theme: 'defensiveMove', csv: MOTIF_CSV },
  /** Kh4 g5+ Kg3 Rg2#: a four-move line. */
  fourMoveMateInTwo: {
    id: HARNESS_CHESS_PUZZLE_MATE_IN_2.id,
    theme: 'mateIn2',
    csv: null,
  },
} as const satisfies Record<string, NamedPuzzle>;

/**
 * `fixtures/chess-puzzles-selection.harness.csv`: twelve distinct, valid
 * positions a scenario stocks the pool from (`puzzle-pool-stock.ts`).
 */
export const POSITION_BANK_CSV = await fixtureCsv(
  'chess-puzzles-selection.harness.csv'
);

const INGEST_HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';

export type IngestRow = {
  readonly id: string;
  readonly valid: boolean;
  readonly line: string;
};

/**
 * A Lichess-shaped import: two valid puzzles (one White solves, one Black
 * solves) and one row per rejection rule, keyed by how a scenario names them.
 */
export const INGEST_ROWS: Readonly<Record<string, IngestRow>> = {
  // Black to move in the FEN, so White solves.
  'White solves a mate in one': {
    id: 'ingW1',
    valid: true,
    line: 'ingW1,6Qk/p1p3pp/4N3/1p6/2q1r1n1/2B5/PP4PP/3R1R1K b - - 0 28,h8g8 f1f8,1230,81,100,900,mate mateIn1 oneMove,https://lichess.org/TaT1Zl7z/black#56,',
  },
  // White to move in the FEN, so Black solves.
  'Black solves a mate in one': {
    id: 'ingB1',
    valid: true,
    line: 'ingB1,2kr1b1r/p1p2pp1/2pqb3/7p/3N2n1/2NPB3/PPP2PPP/R2Q1RK1 w - - 2 13,d4e6 d6h2,1240,95,100,800,kingsideAttack mate mateIn1,https://lichess.org/seIMDWkD#25,Scandinavian_Defense',
  },
  'a line with an illegal move': {
    id: 'ingIllegal',
    valid: false,
    line: 'ingIllegal,6k1/5p1p/1p4p1/p1bN1p2/2Pq1P2/1P5P/1P1Q2P1/7K w - - 1 32,d2c3 g1g2,1250,90,100,50,mate,,',
  },
  'a line that castles without the castling right': {
    id: 'ingCastle',
    valid: false,
    line: 'ingCastle,r3k3/8/8/8/8/8/8/R3K2R b q - 0 1,a8b8 e1g1,1250,90,100,50,endgame,,',
  },
  "a line that ends on the opponent's move": {
    id: 'ingOdd',
    valid: false,
    line: 'ingOdd,8/3R3p/6pk/3p4/2p1b1P1/6KP/r7/4R3 w - - 0 41,g3h4 g6g5 h4g3,1250,90,100,50,endgame,,',
  },
  // Seven ranks.
  'a malformed position': {
    id: 'ingBadFen',
    valid: false,
    line: 'ingBadFen,8/8/8/8/8/8/8 w - - 0 1,e2e4 e7e5,1250,90,100,50,opening,,',
  },
  // Standard puzzle 007hv's position and solution, other clocks, new id.
  "a standard puzzle's position and solution under a new id": {
    id: 'ingDup',
    valid: false,
    line: 'ingDup,6k1/5p1p/1p4p1/p1bN1p2/2Pq1P2/1P5P/1P1Q2P1/7K w - - 0 60,d2c3 d4g1,1250,90,100,50,mate,,',
  },
};

/** The import file for `rows`, in the order given. */
export function ingestCsv(rows: readonly IngestRow[]): string {
  return [INGEST_HEADER, ...rows.map((row) => row.line)].join('\n');
}

/** Every row of {@link INGEST_ROWS}: two valid puzzles and five invalid ones. */
export const FULL_INGEST_ROWS: readonly IngestRow[] =
  Object.values(INGEST_ROWS);
