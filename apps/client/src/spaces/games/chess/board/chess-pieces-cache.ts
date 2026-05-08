import { Skia, type SkSVG } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import type { PieceCode } from './chess-board-types';
import { PIECE_SVGS } from './chess-pieces-svg';

export type PieceSvgCache = Record<PieceCode, SkSVG>;

export function usePieceSkiaSvgs(): PieceSvgCache {
  return useMemo(() => {
    const entries = Object.entries(PIECE_SVGS) as [PieceCode, string][];
    const out = {} as Record<PieceCode, SkSVG>;
    for (const [code, xml] of entries) {
      const svg = Skia.SVG.MakeFromString(xml);
      if (svg === null) {
        throw new Error(`Failed to parse SVG for piece ${code}`);
      }
      out[code] = svg;
    }
    return out;
  }, []);
}
