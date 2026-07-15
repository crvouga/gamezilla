import { Circle, Group, Rect } from '@shopify/react-native-skia';
import { memo, type ReactNode } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  HOVER_NONE,
  indexFromSquare,
  squareFromIndex,
  squareToXY,
} from './chess-board-geometry';
import type {
  BoardOrientation,
  BoardTheme,
  CellHighlight,
  ChessBoardProps,
  Position,
  Square,
} from './chess-board-types';

type CellHighlightsProps = {
  cellHighlights: ChessBoardProps['cellHighlights'];
  size: number;
  orientation: BoardOrientation;
};

export const ChessBoardCellHighlightsLayer = memo(
  function ChessBoardCellHighlightsLayer(
    props: CellHighlightsProps
  ): ReactNode {
    const { cellHighlights, size, orientation } = props;
    if (!cellHighlights) return null;
    const cell = size / 8;
    return (
      <Group>
        {Object.entries(cellHighlights).map(([sq, hl]) =>
          renderCellHighlight({
            sq: sq as Square,
            hl,
            size,
            orientation,
            cell,
          })
        )}
      </Group>
    );
  }
);

type CellHighlightArgs = {
  sq: Square;
  hl: CellHighlight | undefined;
  size: number;
  orientation: BoardOrientation;
  cell: number;
};

function renderCellHighlight(args: CellHighlightArgs): ReactNode {
  const { sq, hl, size, orientation, cell } = args;
  if (hl === undefined) return null;
  const { x, y } = squareToXY(sq, size, orientation);
  const opacity = hl.opacity ?? 0.35;
  if (hl.ring) {
    const stroke = Math.max(2, cell * 0.07);
    const inset = stroke / 2;
    return (
      <Rect
        key={`hl-${sq}`}
        x={x + inset}
        y={y + inset}
        width={cell - stroke}
        height={cell - stroke}
        color={hl.color}
        style="stroke"
        strokeWidth={stroke}
        opacity={opacity}
      />
    );
  }
  return (
    <Rect
      key={`hl-${sq}`}
      x={x}
      y={y}
      width={cell}
      height={cell}
      color={hl.color}
      opacity={opacity}
    />
  );
}

type LastMoveLayerProps = {
  lastMoveFrom: Square | null;
  lastMoveTo: Square | null;
  size: number;
  orientation: BoardOrientation;
  color: string;
};

export const ChessBoardLastMoveLayer = memo(function ChessBoardLastMoveLayer(
  props: LastMoveLayerProps
): ReactNode {
  const { lastMoveFrom, lastMoveTo, size, orientation, color } = props;
  if (lastMoveFrom === null || lastMoveTo === null) return null;
  const cell = size / 8;
  return (
    <Group>
      {[lastMoveFrom, lastMoveTo].map((sq) => {
        const { x, y } = squareToXY(sq, size, orientation);
        return (
          <Rect
            key={`lm-${sq}`}
            x={x}
            y={y}
            width={cell}
            height={cell}
            color={color}
            opacity={0.35}
          />
        );
      })}
    </Group>
  );
});

type SelectionLayerProps = {
  selected: Square | null;
  size: number;
  orientation: BoardOrientation;
  color: string;
};

export const ChessBoardSelectionLayer = memo(function ChessBoardSelectionLayer(
  props: SelectionLayerProps
): ReactNode {
  const { selected, size, orientation, color } = props;
  if (selected === null) return null;
  const cell = size / 8;
  const { x, y } = squareToXY(selected, size, orientation);
  return (
    <Rect x={x} y={y} width={cell} height={cell} color={color} opacity={0.45} />
  );
});

type LegalMovesLayerProps = {
  targets: readonly Square[];
  position: Position;
  turn: 'w' | 'b';
  size: number;
  orientation: BoardOrientation;
  theme: BoardTheme;
  /** UI-thread hide on pointer-up — avoids waiting for React unmount. */
  opacity: SharedValue<number>;
};

export const ChessBoardLegalMovesLayer = memo(
  function ChessBoardLegalMovesLayer(props: LegalMovesLayerProps): ReactNode {
    const { targets, position, turn, size, orientation, theme, opacity } =
      props;
    if (targets.length === 0) return null;
    const cell = size / 8;
    return (
      <Group opacity={opacity}>
        {targets.map((sq) =>
          renderLegalMarker({
            sq,
            position,
            turn,
            size,
            orientation,
            cell,
            theme,
          })
        )}
      </Group>
    );
  }
);

type LegalMarkerArgs = {
  sq: Square;
  position: Position;
  turn: 'w' | 'b';
  size: number;
  orientation: BoardOrientation;
  cell: number;
  theme: BoardTheme;
};

function renderLegalMarker(args: LegalMarkerArgs): ReactNode {
  const { sq, position, turn, size, orientation, cell, theme } = args;
  const { x, y } = squareToXY(sq, size, orientation);
  const cx = x + cell / 2;
  const cy = y + cell / 2;
  const occupant = position[indexFromSquare(sq)] ?? null;
  const isCapture = occupant !== null && occupant?.color !== turn;
  if (isCapture) {
    return (
      <Circle
        key={`cap-${sq}`}
        cx={cx}
        cy={cy}
        r={cell * 0.46}
        color={theme.legalMoveCaptureRing}
        style="stroke"
        strokeWidth={cell * 0.08}
        opacity={0.55}
      />
    );
  }
  return (
    <Circle
      key={`dot-${sq}`}
      cx={cx}
      cy={cy}
      r={cell * 0.16}
      color={theme.legalMoveDot}
      opacity={0.6}
    />
  );
}

type HoverLayerProps = {
  /** UI-thread hover index (-1 = none). Updates never hop to React. */
  hoverSquareIndex: SharedValue<number>;
  size: number;
  orientation: BoardOrientation;
  color: string;
};

export const ChessBoardHoverLayer = memo(function ChessBoardHoverLayer(
  props: HoverLayerProps
): ReactNode {
  const { hoverSquareIndex, size, orientation, color } = props;
  const cell = size / 8;
  const stroke = Math.max(2, cell * 0.08);
  const inset = stroke / 2;
  const dim = cell - stroke;

  const x = useDerivedValue(() => {
    const idx = hoverSquareIndex.value;
    if (idx === HOVER_NONE) return 0;
    return squareToXY(squareFromIndex(idx), size, orientation).x + inset;
  });
  const y = useDerivedValue(() => {
    const idx = hoverSquareIndex.value;
    if (idx === HOVER_NONE) return 0;
    return squareToXY(squareFromIndex(idx), size, orientation).y + inset;
  });
  const opacity = useDerivedValue(() =>
    hoverSquareIndex.value === HOVER_NONE ? 0 : 0.85
  );

  return (
    <Rect
      x={x}
      y={y}
      width={dim}
      height={dim}
      color={color}
      style="stroke"
      strokeWidth={stroke}
      opacity={opacity}
    />
  );
});

type CheckLayerProps = {
  checkKingSquare: Square | null;
  size: number;
  orientation: BoardOrientation;
  color: string;
};

export const ChessBoardCheckLayer = memo(function ChessBoardCheckLayer(
  props: CheckLayerProps
): ReactNode {
  const { checkKingSquare, size, orientation, color } = props;
  if (checkKingSquare === null) return null;
  const cell = size / 8;
  const { x, y } = squareToXY(checkKingSquare, size, orientation);
  return (
    <Rect x={x} y={y} width={cell} height={cell} color={color} opacity={0.28} />
  );
});
