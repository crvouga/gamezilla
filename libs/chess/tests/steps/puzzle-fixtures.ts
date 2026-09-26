/**
 * The puzzles chess scenarios name, mapped to the fixtures the sim seeds or
 * the steps ingest (`libs/chess/fixtures/*.sim.csv`). No step definitions.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChessPuzzleTheme } from '@libs/chess/public/chess-puzzle-themes';
import {
  SIM_CHESS_FIXTURES_DIR,
  SIM_CHESS_PUZZLE_IDS,
  SIM_CHESS_PUZZLE_MATE_IN_2,
} from '@libs/chess/sim/sim-chess-puzzles';

function fixtureCsv(name: string): string {
  return readFileSync(join(SIM_CHESS_FIXTURES_DIR, name), 'utf8');
}

/** The three puzzles every chess sim seeds at boot, in id order. */
export const STANDARD_PUZZLE_IDS: readonly string[] = [
  ...SIM_CHESS_PUZZLE_IDS,
].sort();

/** Fourteen puzzles clustered on the 1500 seed rating. */
export const RATING_CSV = fixtureCsv('chess-puzzles-rating.sim.csv');

/** One puzzle per motif, each with a theme no other seeded puzzle carries. */
export const MOTIF_CSV = fixtureCsv('chess-puzzles-motifs.sim.csv');

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
    id: SIM_CHESS_PUZZLE_MATE_IN_2.id,
    theme: 'mateIn2',
    csv: null,
  },
} as const satisfies Record<string, NamedPuzzle>;

/**
 * `fixtures/chess-puzzles-selection.sim.csv`, by the rows a scenario's
 * "the puzzle pool also holds" table describes.
 */
export const SELECTION_CSV = fixtureCsv('chess-puzzles-selection.sim.csv');

export type SelectionGroup = {
  readonly rated: string;
  readonly quality: string;
  readonly ids: readonly string[];
};

export const SELECTION_GROUPS = {
  goodNear1500: {
    rated: 'near 1500',
    quality: 'good',
    ids: ['008aL', '008cl', '008rw', '009bn'],
  },
  lowQuality: {
    rated: 'near 1500',
    quality: 'too unpopular or too rarely played',
    ids: ['00A8H', '00A9Q', '00AEM', '00AfZ', '00BNd'],
  },
  good1800To1900: {
    rated: '1800 to 1900',
    quality: 'good',
    ids: ['00Bot', '00C8e', '00CYP'],
  },
} as const satisfies Record<string, SelectionGroup>;

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
