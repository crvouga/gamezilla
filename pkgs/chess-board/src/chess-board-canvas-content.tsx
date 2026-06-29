import { Canvas, type SkImage } from '@shopify/react-native-skia';
import { memo, useMemo, type ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { indexFromSquare } from './chess-board-geometry';
import { ChessBoardArrows } from './chess-board-arrows';
import { ChessBoardFeedback } from './chess-board-feedback';
import {
  ChessBoardCellHighlightsLayer,
  ChessBoardCheckLayer,
  ChessBoardHoverLayer,
  ChessBoardLastMoveLayer,
  ChessBoardLegalMovesLayer,
  ChessBoardSelectionLayer,
} from './chess-board-highlights-layer';
import {
  useChessPieceRows,
  type ChessPieceRow,
} from './chess-board-piece-identities';
import { ChessBoardDragPieceSkia } from './chess-board-piece';
import {
  ChessBoardCaptureGhostLayer,
  ChessBoardPiecesLayer,
} from './chess-board-pieces-layer';
import {
  ChessBoardCoordinatesLayer,
  ChessBoardSquaresLayer,
} from './chess-board-squares-layer';
import type {
  BoardArrow,
  BoardOrientation,
  BoardTheme,
  ChessBoardProps,
  Move,
  Square,
} from './chess-board-types';
import type { PieceImageCache } from './chess-pieces-cache';
import { pieceCode } from './chess-pieces-svg';
import { useChessBoardCaptureGhost } from './use-chess-board-capture-ghost';
import type { ChessBoardInteractionState } from './use-chess-board-interaction-state';
import type { useChessGame } from './use-chess-game';

export type ChessBoardCanvasContentProps = {
  size: number;
  orientation: BoardOrientation;
  theme: BoardTheme;
  showCoordinates: boolean;
  highlightLastMove: boolean;
  cellHighlights: ChessBoardProps['cellHighlights'];
  cellFeedback: ChessBoardProps['cellFeedback'];
  pieceImages: PieceImageCache | null;
  pieceDraw: number;
  interaction: ChessBoardInteractionState;
  game: ReturnType<typeof useChessGame>;
  legalTargets: readonly Square[];
  checkKingSquare: Square | null;
  mergedArrows: readonly BoardArrow[];
  /** Inline drag layer (when `dragOverlayPortal` is false). */
  inlineDrag?: {
    dragX: SharedValue<number>;
    dragY: SharedValue<number>;
    isDragging: SharedValue<boolean>;
    dragPickupScale: SharedValue<number>;
    dragPickupOpacity: SharedValue<number>;
  } | null;
};

type StaticLayersProps = {
  size: number;
  orientation: BoardOrientation;
  theme: BoardTheme;
  showCoordinates: boolean;
  cellHighlights: ChessBoardProps['cellHighlights'];
};

function StaticLayers(p: StaticLayersProps): ReactNode {
  return (
    <>
      <ChessBoardSquaresLayer
        size={p.size}
        theme={p.theme}
        orientation={p.orientation}
      />
      <ChessBoardCellHighlightsLayer
        cellHighlights={p.cellHighlights}
        size={p.size}
        orientation={p.orientation}
      />
      <ChessBoardCoordinatesLayer
        size={p.size}
        theme={p.theme}
        orientation={p.orientation}
        show={p.showCoordinates}
      />
    </>
  );
}

type MarkerLayersProps = {
  size: number;
  orientation: BoardOrientation;
  theme: BoardTheme;
  lastMove: Move | null;
  highlightLastMove: boolean;
  selected: Square | null;
  legalTargets: readonly Square[];
  hoveredSquare: Square | null;
  checkKingSquare: Square | null;
  position: ReturnType<typeof useChessGame>['position'];
  turn: 'w' | 'b';
};

function MarkerLayers(p: MarkerLayersProps): ReactNode {
  return (
    <>
      <ChessBoardLastMoveLayer
        lastMoveFrom={
          p.highlightLastMove && p.lastMove ? p.lastMove.from : null
        }
        lastMoveTo={p.highlightLastMove && p.lastMove ? p.lastMove.to : null}
        size={p.size}
        orientation={p.orientation}
        color={p.theme.lastMove}
      />
      <ChessBoardSelectionLayer
        selected={p.selected}
        size={p.size}
        orientation={p.orientation}
        color={p.theme.selected}
      />
      <ChessBoardLegalMovesLayer
        targets={p.legalTargets}
        position={p.position}
        turn={p.turn}
        size={p.size}
        orientation={p.orientation}
        theme={p.theme}
      />
      <ChessBoardHoverLayer
        hoveredSquare={p.hoveredSquare}
        size={p.size}
        orientation={p.orientation}
        color={p.theme.selected}
      />
      <ChessBoardCheckLayer
        checkKingSquare={p.checkKingSquare}
        size={p.size}
        orientation={p.orientation}
        color={p.theme.check}
      />
    </>
  );
}

type PieceLayersProps = {
  ghost: ReturnType<typeof useChessBoardCaptureGhost>['captureGhost'];
  pieceRows: readonly ChessPieceRow[];
  dragFrom: Square | null;
  pieceImages: PieceImageCache | null;
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
};

function PieceLayers(p: PieceLayersProps): ReactNode {
  return (
    <>
      <ChessBoardCaptureGhostLayer
        ghost={p.ghost}
        pieceImages={p.pieceImages}
        size={p.size}
        orientation={p.orientation}
        pieceDraw={p.pieceDraw}
      />
      <ChessBoardPiecesLayer
        pieceRows={p.pieceRows}
        dragFrom={p.dragFrom}
        pieceImages={p.pieceImages}
        size={p.size}
        orientation={p.orientation}
        pieceDraw={p.pieceDraw}
      />
    </>
  );
}

type OverlayLayersProps = {
  arrows: readonly BoardArrow[];
  cellFeedback: ChessBoardProps['cellFeedback'];
  size: number;
  orientation: BoardOrientation;
  theme: BoardTheme;
};

function useInlineDragImage(args: {
  dragFrom: Square | null;
  position: ReturnType<typeof useChessGame>['position'];
  pieceImages: PieceImageCache | null;
}): SkImage | null {
  const { dragFrom, position, pieceImages } = args;
  return useMemo(() => {
    if (pieceImages === null) return null;
    if (dragFrom !== null) {
      const piece = position[indexFromSquare(dragFrom)] ?? null;
      if (piece) {
        const code = pieceCode(piece.color, piece.type);
        if (code !== null) return pieceImages[code];
      }
    }
    return pieceImages.wp;
  }, [dragFrom, position, pieceImages]);
}

function InlineDragLayer(p: {
  inlineDrag: NonNullable<ChessBoardCanvasContentProps['inlineDrag']>;
  dragFrom: Square | null;
  position: ReturnType<typeof useChessGame>['position'];
  pieceImages: PieceImageCache | null;
  pieceDraw: number;
}): ReactNode {
  const image = useInlineDragImage({
    dragFrom: p.dragFrom,
    position: p.position,
    pieceImages: p.pieceImages,
  });
  if (image === null) return null;
  return (
    <ChessBoardDragPieceSkia
      image={image}
      pieceSize={p.pieceDraw}
      dragX={p.inlineDrag.dragX}
      dragY={p.inlineDrag.dragY}
      isDragging={p.inlineDrag.isDragging}
      pickupScale={p.inlineDrag.dragPickupScale}
      pickupOpacity={p.inlineDrag.dragPickupOpacity}
    />
  );
}

function OverlayLayers(p: OverlayLayersProps): ReactNode {
  return (
    <>
      <ChessBoardArrows
        arrows={p.arrows}
        size={p.size}
        orientation={p.orientation}
        theme={p.theme}
      />
      <ChessBoardFeedback
        cellFeedback={p.cellFeedback}
        size={p.size}
        orientation={p.orientation}
        theme={p.theme}
      />
    </>
  );
}

function ChessBoardCanvasContentImpl(
  props: ChessBoardCanvasContentProps
): ReactNode {
  const { size, game, interaction } = props;
  const { position, lastMove } = game;
  const { active: pieceRows } = useChessPieceRows(position, lastMove);
  const { captureGhost } = useChessBoardCaptureGhost(position, lastMove);
  return (
    <Canvas style={{ width: size, height: size }}>
      <StaticLayers
        size={size}
        orientation={props.orientation}
        theme={props.theme}
        showCoordinates={props.showCoordinates}
        cellHighlights={props.cellHighlights}
      />
      <MarkerLayers
        size={size}
        orientation={props.orientation}
        theme={props.theme}
        lastMove={lastMove}
        highlightLastMove={props.highlightLastMove}
        selected={interaction.selected}
        legalTargets={props.legalTargets}
        hoveredSquare={interaction.hoveredSquare}
        checkKingSquare={props.checkKingSquare}
        position={position}
        turn={game.turn}
      />
      <PieceLayers
        ghost={captureGhost}
        pieceRows={pieceRows}
        dragFrom={interaction.dragFrom}
        pieceImages={props.pieceImages}
        size={size}
        orientation={props.orientation}
        pieceDraw={props.pieceDraw}
      />
      {props.inlineDrag !== undefined && props.inlineDrag !== null ? (
        <InlineDragLayer
          inlineDrag={props.inlineDrag}
          dragFrom={interaction.dragFrom}
          position={position}
          pieceImages={props.pieceImages}
          pieceDraw={props.pieceDraw}
        />
      ) : null}
      <OverlayLayers
        arrows={props.mergedArrows}
        cellFeedback={props.cellFeedback}
        size={size}
        orientation={props.orientation}
        theme={props.theme}
      />
    </Canvas>
  );
}

export const ChessBoardCanvasContent = memo(ChessBoardCanvasContentImpl);
