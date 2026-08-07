import {
  DashPathEffect,
  Group,
  Path,
  Skia,
  type SkPath,
} from '@shopify/react-native-skia';
import { memo, type ReactNode, useMemo } from 'react';
import { squareToXY } from './chess-board-geometry';
import type {
  BoardArrow,
  BoardOrientation,
  BoardTheme,
  Square,
} from './chess-board-types';

function squareCenter(
  square: Square,
  size: number,
  orientation: BoardOrientation
): { x: number; y: number; cell: number } {
  const cell = size / 8;
  const { x, y } = squareToXY(square, size, orientation);
  return { x: x + cell / 2, y: y + cell / 2, cell };
}

function fileRankIndex(square: Square): { f: number; r: number } {
  return {
    f: square.charCodeAt(0) - 97,
    r: square.charCodeAt(1) - 49,
  };
}

function isKnightJump(from: Square, to: Square): boolean {
  const a = fileRankIndex(from);
  const b = fileRankIndex(to);
  const df = Math.abs(a.f - b.f);
  const dr = Math.abs(a.r - b.r);
  return (df === 1 && dr === 2) || (df === 2 && dr === 1);
}

type StraightArgs = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
};

/**
 * Builds a stroked shaft + arrowhead path from `(x1,y1)` to `(x2,y2)`. The
 * shaft is shortened so the head sits flush with the destination square.
 */
function buildStraightArrow(args: StraightArgs): {
  shaft: SkPath;
  head: SkPath;
} {
  const { x1, y1, x2, y2, thickness } = args;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;

  const headLen = Math.max(thickness * 2.4, 14);
  const headHalfWidth = Math.max(thickness * 1.6, 9);
  const tipX = x2;
  const tipY = y2;
  const baseX = tipX - ux * headLen;
  const baseY = tipY - uy * headLen;
  const perpX = -uy;
  const perpY = ux;

  const shaft = Skia.Path.Make();
  shaft.moveTo(x1, y1);
  shaft.lineTo(baseX, baseY);

  const head = Skia.Path.Make();
  head.moveTo(tipX, tipY);
  head.lineTo(baseX + perpX * headHalfWidth, baseY + perpY * headHalfWidth);
  head.lineTo(baseX - perpX * headHalfWidth, baseY - perpY * headHalfWidth);
  head.close();

  return { shaft, head };
}

type KnightArgs = {
  from: Square;
  to: Square;
  size: number;
  orientation: BoardOrientation;
  thickness: number;
};

function knightCorner(
  a: { x: number; y: number },
  b: { x: number; y: number }
): { x: number; y: number } {
  const verticalLeg = Math.abs(a.y - b.y) > Math.abs(a.x - b.x);
  return verticalLeg ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
}

type ArrowHead = {
  baseX: number;
  baseY: number;
  perpX: number;
  perpY: number;
};

function arrowHeadGeometry(args: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  headLen: number;
}): ArrowHead {
  const { from, to, headLen } = args;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  return {
    baseX: to.x - ux * headLen,
    baseY: to.y - uy * headLen,
    perpX: -uy,
    perpY: ux,
  };
}

/**
 * Knight (L-shape) arrow: longer leg first, then a 90deg corner. Mirrors the
 * lichess convention: travel along the file first, then the rank.
 */
function buildKnightArrow(args: KnightArgs): { shaft: SkPath; head: SkPath } {
  const { from, to, size, orientation, thickness } = args;
  const a = squareCenter(from, size, orientation);
  const b = squareCenter(to, size, orientation);
  const corner = knightCorner(a, b);
  const headLen = Math.max(thickness * 2.4, 14);
  const headHalfWidth = Math.max(thickness * 1.6, 9);
  const g = arrowHeadGeometry({ from: corner, to: b, headLen });

  const shaft = Skia.Path.Make();
  shaft.moveTo(a.x, a.y);
  shaft.lineTo(corner.x, corner.y);
  shaft.lineTo(g.baseX, g.baseY);

  const head = Skia.Path.Make();
  head.moveTo(b.x, b.y);
  head.lineTo(
    g.baseX + g.perpX * headHalfWidth,
    g.baseY + g.perpY * headHalfWidth
  );
  head.lineTo(
    g.baseX - g.perpX * headHalfWidth,
    g.baseY - g.perpY * headHalfWidth
  );
  head.close();

  return { shaft, head };
}

type SingleArrowProps = {
  arrow: BoardArrow;
  size: number;
  orientation: BoardOrientation;
  theme: BoardTheme;
};

function SingleArrow({
  arrow,
  size,
  orientation,
  theme,
}: SingleArrowProps): ReactNode {
  const cell = size / 8;
  const thicknessFraction = arrow.thickness ?? 0.14;
  const thickness = Math.max(3, cell * thicknessFraction);
  const opacity = arrow.opacity ?? 0.85;
  const color = arrow.color ?? theme.arrows.primary;
  const isKnight = arrow.knight ?? isKnightJump(arrow.from, arrow.to);

  const { shaft, head } = useMemo(() => {
    if (isKnight) {
      return buildKnightArrow({
        from: arrow.from,
        to: arrow.to,
        size,
        orientation,
        thickness,
      });
    }
    const a = squareCenter(arrow.from, size, orientation);
    const b = squareCenter(arrow.to, size, orientation);
    return buildStraightArrow({
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      thickness,
    });
  }, [arrow.from, arrow.to, isKnight, orientation, size, thickness]);

  return (
    <Group opacity={opacity}>
      <Path
        path={shaft}
        color={color}
        style="stroke"
        strokeWidth={thickness}
        strokeJoin="round"
        strokeCap="round"
      >
        {arrow.dashed === true ? (
          <DashPathEffect intervals={[thickness * 1.6, thickness * 1.2]} />
        ) : null}
      </Path>
      <Path path={head} color={color} style="fill" />
    </Group>
  );
}

export type ChessBoardArrowsProps = {
  arrows: readonly BoardArrow[];
  size: number;
  orientation: BoardOrientation;
  theme: BoardTheme;
};

function ChessBoardArrowsImpl(props: ChessBoardArrowsProps): ReactNode {
  const { arrows, size, orientation, theme } = props;
  if (arrows.length === 0) return null;
  return (
    <Group>
      {arrows.map((arrow, idx) => (
        <SingleArrow
          key={arrow.id ?? `${arrow.from}-${arrow.to}-${idx}`}
          arrow={arrow}
          size={size}
          orientation={orientation}
          theme={theme}
        />
      ))}
    </Group>
  );
}

export const ChessBoardArrows = memo(ChessBoardArrowsImpl);
