import { type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { type SharedValue } from 'react-native-reanimated';
import type { ChessBoardCanvasContentProps } from './chess-board-canvas-content';
import { ChessBoardCanvasContent } from './chess-board-canvas-content';
import { DragPieceOverlay } from './chess-board-drag-piece-overlay';
import type { useBoardGestures } from './chess-board-gestures';
import {
  ChessBoardPromotionInline,
  ChessBoardPromotionModal,
} from './chess-board-promotion';
import type {
  BoardOrientation,
  BoardTheme,
  Move,
  PieceCode,
} from './chess-board-types';
import type { PieceImageCache } from './chess-pieces-cache';
import type { UseChessBoardDragOverlayResult } from './use-chess-board-drag-overlay';
import type { PendingPromotion } from './use-chess-board-interaction-state';

type GestureLike = ReturnType<typeof useBoardGestures>;

type DragValues = {
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  dragPickupScale: SharedValue<number>;
  dragPickupOpacity: SharedValue<number>;
};

export type ChessBoardViewProps = {
  size: number;
  theme: BoardTheme;
  orientation: BoardOrientation;
  promotionStyle: 'inline' | 'modal';
  dragOverlayPortal: boolean;
  pendingPromotion: PendingPromotion | null;
  pieceImages: PieceImageCache | null;
  pieceDraw: number;
  draggedPieceCode: PieceCode | null;
  drag: DragValues;
  gesture: GestureLike;
  dragOverlay: UseChessBoardDragOverlayResult;
  composedContainerRef: (n: View | null) => void;
  userArrowsWebHandlers: Record<string, unknown>;
  onPromotionCancel: () => void;
  onPromotionPick: (p: NonNullable<Move['promotion']>) => void;
  contentProps: ChessBoardCanvasContentProps;
};

function inlineDrag(p: ChessBoardViewProps): ReactNode {
  if (p.dragOverlayPortal) return null;
  return (
    <DragPieceOverlay
      pieceImages={p.pieceImages}
      draggedPieceCode={p.draggedPieceCode}
      dragX={p.drag.dragX}
      dragY={p.drag.dragY}
      isDragging={p.drag.isDragging}
      dragPickupOpacity={p.drag.dragPickupOpacity}
      dragPickupScale={p.drag.dragPickupScale}
      pieceDraw={p.pieceDraw}
    />
  );
}

type PromotionInlineProps = {
  pending: PendingPromotion | null;
  size: number;
  orientation: BoardOrientation;
  theme: BoardTheme;
  pieceImages: PieceImageCache | null;
  onCancel: () => void;
  onPick: (p: NonNullable<Move['promotion']>) => void;
};

function inlinePromotion(p: PromotionInlineProps): ReactNode {
  if (p.pending === null) return null;
  return (
    <ChessBoardPromotionInline
      color={p.pending.color}
      to={p.pending.to}
      size={p.size}
      orientation={p.orientation}
      theme={p.theme}
      pieceImages={p.pieceImages}
      onCancel={p.onCancel}
      onPick={p.onPick}
    />
  );
}

type PromotionModalProps = {
  pending: PendingPromotion | null;
  onCancel: () => void;
  onPick: (p: NonNullable<Move['promotion']>) => void;
};

function modalPromotion(p: PromotionModalProps): ReactNode {
  return (
    <ChessBoardPromotionModal
      visible={p.pending !== null}
      onCancel={p.onCancel}
      onPick={p.onPick}
    />
  );
}

/** Renders the board surface: gesture root → outer view → animated canvas
 * stack → optional inline drag piece + promotion overlays. Pure rendering;
 * all logic and state come from props. */
export function ChessBoardView(p: ChessBoardViewProps): ReactNode {
  const { size } = p;
  const sqStyle = { width: size, height: size, overflow: 'visible' as const };
  return (
    <GestureDetector gesture={p.gesture}>
      <View
        ref={p.composedContainerRef}
        onLayout={p.dragOverlay.onContainerLayout}
        style={sqStyle}
        {...p.userArrowsWebHandlers}
      >
        <Animated.View style={sqStyle}>
          <ChessBoardCanvasContent {...p.contentProps} />
          {inlineDrag(p)}
          {p.promotionStyle === 'inline'
            ? inlinePromotion({
                pending: p.pendingPromotion,
                size: p.size,
                orientation: p.orientation,
                theme: p.theme,
                pieceImages: p.pieceImages,
                onCancel: p.onPromotionCancel,
                onPick: p.onPromotionPick,
              })
            : null}
        </Animated.View>
        {p.promotionStyle === 'modal'
          ? modalPromotion({
              pending: p.pendingPromotion,
              onCancel: p.onPromotionCancel,
              onPick: p.onPromotionPick,
            })
          : null}
      </View>
    </GestureDetector>
  );
}
