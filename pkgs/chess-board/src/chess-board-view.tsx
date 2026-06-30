import { memo, type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import type { ChessBoardCanvasContentProps } from './chess-board-canvas-content';
import { ChessBoardCanvasContent } from './chess-board-canvas-content';
import type { useBoardGestures } from './chess-board-gestures';
import { ChessBoardPromotionInline } from './chess-board-promotion';
import type { BoardOrientation, BoardTheme, Move } from './chess-board-types';
import type { PieceImageCache } from './chess-pieces-cache';
import type { UseChessBoardDragOverlayResult } from './use-chess-board-drag-overlay';
import type { PendingPromotion } from './use-chess-board-interaction-state';

type GestureLike = ReturnType<typeof useBoardGestures>;

export type ChessBoardViewProps = {
  size: number;
  theme: BoardTheme;
  orientation: BoardOrientation;
  dragOverlayPortal: boolean;
  pendingPromotion: PendingPromotion | null;
  pieceImages: PieceImageCache | null;
  pieceDraw: number;
  gesture: GestureLike;
  dragOverlay: UseChessBoardDragOverlayResult;
  composedContainerRef: (n: View | null) => void;
  userArrowsWebHandlers: Record<string, unknown>;
  onPromotionCancel: () => void;
  onPromotionPick: (p: NonNullable<Move['promotion']>) => void;
  contentProps: ChessBoardCanvasContentProps;
};

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

/** Renders the board surface: gesture root → outer view → animated canvas
 * stack → optional inline drag piece + promotion overlay. Pure rendering;
 * all logic and state come from props. */
function ChessBoardViewImpl(p: ChessBoardViewProps): ReactNode {
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
          {inlinePromotion({
            pending: p.pendingPromotion,
            size: p.size,
            orientation: p.orientation,
            theme: p.theme,
            pieceImages: p.pieceImages,
            onCancel: p.onPromotionCancel,
            onPick: p.onPromotionPick,
          })}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export const ChessBoardView = memo(ChessBoardViewImpl);
