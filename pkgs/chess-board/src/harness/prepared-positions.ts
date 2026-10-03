import { Chess } from 'chess.js';
import {
  CHECKMATED,
  STALEMATED,
  WHITE_PROMOTION,
} from './interaction-fixtures';
import { INITIAL, REPLACEMENT } from './positions';
export function afterPreparedMove(
  fen: string,
  from: string,
  to: string,
  promotion?: string
) {
  const chess = new Chess(fen);
  chess.move({ from, to, ...(promotion === undefined ? {} : { promotion }) });
  return chess.fen();
}
export const PREPARED_OPTIONS = {
  opening: INITIAL,
  promotion: WHITE_PROMOTION,
  replacement: REPLACEMENT,
  moved: afterPreparedMove(INITIAL, 'e2', 'e4'),
};
export const PREPARED_PROMOTIONS = {
  ready: WHITE_PROMOTION,
  replacement: REPLACEMENT,
  checkmate: CHECKMATED,
  stalemate: STALEMATED,
  'rook moved': afterPreparedMove(WHITE_PROMOTION, 'h1', 'h2'),
  queen: afterPreparedMove(WHITE_PROMOTION, 'a7', 'a8', 'q'),
  rook: afterPreparedMove(WHITE_PROMOTION, 'a7', 'a8', 'r'),
  bishop: afterPreparedMove(WHITE_PROMOTION, 'a7', 'a8', 'b'),
  knight: afterPreparedMove(WHITE_PROMOTION, 'a7', 'a8', 'n'),
};
export function identifyPreparedPosition(
  fen: string,
  positions: Readonly<Record<string, string>>
): string {
  return (
    Object.entries(positions).find(([, prepared]) => prepared === fen)?.[0] ??
    'unrecognized: ' + fen
  );
}
