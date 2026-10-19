import type { Move, Square } from '@pkgs/chess-board-core-shared/types';
import { Chess } from 'chess.js';

export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const CAPTURE = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
const CASTLE =
  'r3k2r/pppqbppp/2n1bn2/3pp3/3PP3/2N1BN2/PPPQBPPP/R3K2R w KQkq - 0 1';
const EN_PASSANT =
  'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3';
export const WHITE_PROMOTION = '1n5k/P7/8/8/8/8/8/6K1 w - - 0 1';
const BLACK_PROMOTION = '6k1/8/8/8/8/8/p7/1N4K1 b - - 0 1';
export const MIDDLEGAME =
  'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5';
const CHECKMATED = '7k/6Q1/5K2/8/8/8/8/8 b - - 0 1';
const STALEMATED = '7k/5K2/6Q1/8/8/8/8/8 b - - 0 1';
const DRAWN = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
const VERIFY_IN_ONE =
  'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
export const MATE_IN_ONE =
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
const STALEMATE_IN_ONE = '7k/8/5QK1/8/8/8/8/8 w - - 0 1';
const PINNED = 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/3P4/PPP2PPP/RNBQKBNR w KQkq - 1 3';
export const PROMOTION_CHOICES = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
} as const;
type EmissionCase = {
  name: string;
  fen: string;
  from: Square;
  to: Square;
  inputTo?: Square;
  promotion?: Move['promotion'];
  orientation?: 'white' | 'black';
  announcement?: string;
};
const PROMOTION_MATRIX: readonly EmissionCase[] = [
  {
    side: 'White',
    fen: WHITE_PROMOTION,
    from: 'a7',
    quiet: 'a8',
    capture: 'b8',
  },
  {
    side: 'Black',
    fen: BLACK_PROMOTION,
    from: 'a2',
    quiet: 'a1',
    capture: 'b1',
  },
].flatMap((setup) =>
  (['white', 'black'] as const).flatMap((orientation) =>
    (['q', 'r', 'b', 'n'] as const).flatMap((promotion) =>
      (['quiet', 'capture'] as const).map((kind) => ({
        name: `${setup.side} ${kind} promotion to ${promotion} facing ${orientation}`,
        fen: setup.fen,
        from: setup.from as Square,
        to: setup[kind] as Square,
        promotion,
        orientation,
      }))
    )
  )
);
const LEGAL_CASES: readonly EmissionCase[] = [
  { name: 'opening knight', fen: START, from: 'g1', to: 'f3' },
  { name: 'opening pawn', fen: START, from: 'e2', to: 'e4' },
  { name: 'pawn capture', fen: CAPTURE, from: 'e4', to: 'd5' },
  { name: 'passed pawn capture', fen: EN_PASSANT, from: 'e5', to: 'f6' },
  {
    name: 'checking queen',
    fen: VERIFY_IN_ONE,
    from: 'd1',
    to: 'h5',
    announcement: 'Queen to h5, check',
  },
  {
    name: 'mating capture',
    fen: MATE_IN_ONE,
    from: 'f3',
    to: 'f7',
    announcement: 'Queen takes f7, checkmate',
  },
  { name: 'stalemating queen', fen: STALEMATE_IN_ONE, from: 'f6', to: 'f7' },
  {
    name: 'permitted check response',
    fen: oracleAfter(VERIFY_IN_ONE, 'Qh5').fen(),
    from: 'g7',
    to: 'g6',
  },
  { name: 'White kingside castle', fen: CASTLE, from: 'e1', to: 'g1' },
  { name: 'White queenside castle', fen: CASTLE, from: 'e1', to: 'c1' },
  {
    name: 'Black kingside castle',
    fen: CASTLE.replace(' w ', ' b '),
    from: 'e8',
    to: 'g8',
  },
  {
    name: 'Black queenside castle',
    fen: CASTLE.replace(' w ', ' b '),
    from: 'e8',
    to: 'c8',
  },
  {
    name: 'White king onto kingside rook',
    fen: CASTLE,
    from: 'e1',
    to: 'g1',
    inputTo: 'h1',
  },
  {
    name: 'White king onto queenside rook',
    fen: CASTLE,
    from: 'e1',
    to: 'c1',
    inputTo: 'a1',
  },
  {
    name: 'Black king onto kingside rook',
    fen: CASTLE.replace(' w ', ' b '),
    from: 'e8',
    to: 'g8',
    inputTo: 'h8',
  },
  {
    name: 'Black king onto queenside rook',
    fen: CASTLE.replace(' w ', ' b '),
    from: 'e8',
    to: 'c8',
    inputTo: 'a8',
  },
  ...PROMOTION_MATRIX,
];
export const EMISSION_CASES = LEGAL_CASES.flatMap((position) =>
  (position.inputTo === undefined
    ? (['selection', 'drag', 'keyboard'] as const)
    : (['drag'] as const)
  ).map((gesture) => ({
    name: `${position.name} via ${gesture}`,
    position,
    gesture,
  }))
);

function oracleAfter(fen: string, move: string): Chess {
  const oracle = new Chess(fen);
  oracle.move(move);
  return oracle;
}

export const SELECTION_CASES = [
  MIDDLEGAME,
  MIDDLEGAME.replace(' b ', ' w '),
  CASTLE,
  CASTLE.replace(' w ', ' b '),
  'k3r3/8/8/8/8/8/R7/4K3 w - - 0 1',
  PINNED,
  EN_PASSANT,
  oracleAfter(VERIFY_IN_ONE, 'Qh5').fen(),
];
export const NO_EFFECT_CASES = [
  {
    name: 'White turn opposing and empty squares',
    fen: START,
    interactive: true,
  },
  {
    name: 'Black turn off-turn and empty squares',
    fen: START.replace(' w ', ' b '),
    interactive: true,
  },
  {
    name: 'Black reply off-turn and empty squares',
    fen: oracleAfter(START, 'e4').fen(),
    interactive: true,
  },
  { name: 'checkmate all 64 sources', fen: CHECKMATED, interactive: true },
  { name: 'stalemate all 64 sources', fen: STALEMATED, interactive: true },
  { name: 'draw all 64 sources', fen: DRAWN, interactive: true },
  { name: 'disabled all 64 sources', fen: START, interactive: false },
];
const REFUSAL_CASES = [
  { name: 'illegal pawn advance', fen: START, from: 'e2', to: 'e5' },
  { name: 'blocked bishop move', fen: START, from: 'f1', to: 'f5' },
  {
    name: 'pinned pawn advance one square',
    fen: 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/3P4/PPP2PPP/RNBQKBNR w KQkq - 1 3',
    from: 'f2',
    to: 'f3',
  },
  {
    name: 'pinned pawn advance two squares',
    fen: 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/3P4/PPP2PPP/RNBQKBNR w KQkq - 1 3',
    from: 'f2',
    to: 'f4',
  },
  {
    name: 'non-answer to check',
    fen: oracleAfter(VERIFY_IN_ONE, 'Qh5').fen(),
    from: 'a7',
    to: 'a6',
  },
  {
    name: 'own-piece capture',
    fen: START,
    from: 'e2',
    to: 'd2',
    onlyDrag: true,
  },
] satisfies readonly (EmissionCase & { onlyDrag?: boolean })[];
export const REFUSAL_INPUTS = REFUSAL_CASES.flatMap((position) =>
  (position.onlyDrag === true
    ? (['drag'] as const)
    : (['selection', 'drag', 'keyboard'] as const)
  ).map((gesture) => ({
    name: `${position.name} via ${gesture}`,
    position,
    gesture,
  }))
);
