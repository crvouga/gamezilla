/**
 * Piece sprites as `data:` URIs built once from the core Cburnett SVG set, so
 * `<image href>` / `<img src>` can draw them without a bundler asset pipeline
 * and without `innerHTML`.
 */

import { PIECE_SVGS } from '@pkgs/chess-board-core/piece-svgs';
import type {
  PieceCode,
  PieceColor,
  PieceType,
} from '@pkgs/chess-board-core/types';

export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PIECE_CODES = Object.keys(PIECE_SVGS) as PieceCode[];

export const PIECE_IMAGE_URIS: Readonly<Record<PieceCode, string>> =
  Object.freeze(
    Object.fromEntries(
      PIECE_CODES.map((code) => [code, svgToDataUri(PIECE_SVGS[code])])
    ) as Record<PieceCode, string>
  );

export function pieceImageUri(color: PieceColor, type: PieceType): string {
  return PIECE_IMAGE_URIS[`${color}${type}`];
}
