import { Group, Rect, Text as SkiaText } from '@shopify/react-native-skia';
import { memo, useMemo, type ReactNode } from 'react';
import { squareFromIndex, squareToXY } from './chess-board-geometry';
import { createChessBoardSkiaFont } from './chess-board-skia-font';
import type { BoardOrientation, BoardTheme, Square } from './chess-board-types';

type SquaresLayerProps = {
  size: number;
  theme: BoardTheme;
  orientation: BoardOrientation;
};

/** 64 colored squares. Memoized: only re-renders on size/theme/orientation. */
export const ChessBoardSquaresLayer = memo(function ChessBoardSquaresLayer(
  props: SquaresLayerProps
): ReactNode {
  const { size, theme, orientation } = props;
  const cell = size / 8;
  return (
    <Group>
      {Array.from({ length: 64 }).map((_, i) => {
        const square = squareFromIndex(i);
        const { x, y } = squareToXY(square, size, orientation);
        const row = Math.floor(i / 8);
        const col = i % 8;
        const isDark = (row + col) % 2 === 1;
        return (
          <Rect
            key={`sq-${square}`}
            x={x}
            y={y}
            width={cell}
            height={cell}
            color={isDark ? theme.darkSquare : theme.lightSquare}
          />
        );
      })}
    </Group>
  );
});

type CoordinatesLayerProps = {
  size: number;
  theme: BoardTheme;
  orientation: BoardOrientation;
  show: boolean;
};

function buildCoordEntries(
  orientation: BoardOrientation
): readonly { idx: number; file: string; rank: string }[] {
  const out: { idx: number; file: string; rank: string }[] = [];
  for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
    const file =
      orientation === 'white'
        ? String.fromCharCode('a'.charCodeAt(0) + fileIdx)
        : String.fromCharCode('a'.charCodeAt(0) + (7 - fileIdx));
    const rank =
      orientation === 'white' ? String(8 - fileIdx) : String(fileIdx + 1);
    out.push({ idx: fileIdx, file, rank });
  }
  return out;
}

function fileCoordSquare(
  orientation: BoardOrientation,
  fileIdx: number
): Square {
  const file =
    orientation === 'white'
      ? String.fromCharCode('a'.charCodeAt(0) + fileIdx)
      : String.fromCharCode('a'.charCodeAt(0) + (7 - fileIdx));
  return `${file}1` as Square;
}

function rankCoordSquare(
  orientation: BoardOrientation,
  fileIdx: number
): Square {
  if (orientation === 'white') return `a${String(8 - fileIdx)}` as Square;
  return `h${String(fileIdx + 1)}` as Square;
}

/** File + rank labels in the cell corners. Memoized by size/theme/orientation. */
export const ChessBoardCoordinatesLayer = memo(
  function ChessBoardCoordinatesLayer(props: CoordinatesLayerProps): ReactNode {
    const { size, theme, orientation, show } = props;
    const cell = size / 8;
    const font = useMemo(() => {
      const fontSize = Math.max(10, Math.floor(cell * 0.22));
      return createChessBoardSkiaFont(fontSize);
    }, [cell]);
    const entries = useMemo(
      () => buildCoordEntries(orientation),
      [orientation]
    );
    if (!show || font === null) return null;
    return (
      <Group>
        {entries.map(({ idx, file, rank }) => {
          const filePos = squareToXY(
            fileCoordSquare(orientation, idx),
            size,
            orientation
          );
          const rankPos = squareToXY(
            rankCoordSquare(orientation, idx),
            size,
            orientation
          );
          return (
            <Group key={`coord-${idx}`}>
              <SkiaText
                x={filePos.x + cell * 0.82}
                y={filePos.y + cell * 0.95}
                text={file}
                font={font}
                color={theme.coordinates}
                opacity={0.75}
              />
              <SkiaText
                x={rankPos.x + cell * 0.08}
                y={rankPos.y + cell * 0.25}
                text={rank}
                font={font}
                color={theme.coordinates}
                opacity={0.75}
              />
            </Group>
          );
        })}
      </Group>
    );
  }
);
