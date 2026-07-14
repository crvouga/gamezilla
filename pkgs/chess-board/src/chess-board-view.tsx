import { memo, type ReactNode } from 'react';
import { View } from 'react-native';
import type { ChessBoardCanvasContentProps } from './chess-board-canvas-content';
import { ChessBoardCanvasContent } from './chess-board-canvas-content';
import { ChessBoardInteractionLayer } from './chess-board-interaction-layer';
import type { ChessBoardInteractionLayerProps } from './chess-board-interaction-layer';
import { ChessBoardPromotionInline } from './chess-board-promotion';
import type { BoardOrientation, BoardTheme, Move } from './chess-board-types';
import type { PieceImageCache } from './chess-pieces-cache';
import type { PendingPromotion } from './use-chess-board-interaction-state';

export type ChessBoardViewProps = {
  size: number;
  theme: BoardTheme;
  orientation: BoardOrientation;
  pendingPromotion: PendingPromotion | null;
  pieceImages: PieceImageCache | null;
  pieceDraw: number;
  containerRef: (n: View | null) => void;
  userArrowsWebHandlers: Record<string, unknown>;
  onPromotionCancel: () => void;
  onPromotionPick: (p: NonNullable<Move['promotion']>) => void;
  contentProps: ChessBoardCanvasContentProps;
  interactionProps: ChessBoardInteractionLayerProps;
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

/** Board surface: Skia chrome + pieces underlay + thin gesture surface + promotion. */
function ChessBoardViewImpl(p: ChessBoardViewProps): ReactNode {
  const { size } = p;
  const sqStyle = { width: size, height: size, overflow: 'visible' as const };
  return (
    <View ref={p.containerRef} style={sqStyle} {...p.userArrowsWebHandlers}>
      <View style={sqStyle}>
        <ChessBoardCanvasContent {...p.contentProps} />
        <ChessBoardInteractionLayer {...p.interactionProps} />
        {inlinePromotion({
          pending: p.pendingPromotion,
          size: p.size,
          orientation: p.orientation,
          theme: p.theme,
          pieceImages: p.pieceImages,
          onCancel: p.onPromotionCancel,
          onPick: p.onPromotionPick,
        })}
      </View>
    </View>
  );
}

export const ChessBoardView = memo(ChessBoardViewImpl);
