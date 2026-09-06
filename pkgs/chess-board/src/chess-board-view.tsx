import { Box, useOverlayPortal, useOverlayPortalHostFrame } from '@pkgs/ui-rn';
import { memo, type ReactNode, useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';
import { Platform } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import type { ChessBoardCanvasContentProps } from './chess-board-canvas-content';
import { ChessBoardCanvasContent } from './chess-board-canvas-content';
import {
  ChessBoardDragPreview,
  useChessBoardPortalDragAvailable,
} from './chess-board-drag-preview';
import type { ChessBoardInteractionLayerProps } from './chess-board-interaction-layer';
import { ChessBoardInteractionLayer } from './chess-board-interaction-layer';
import { ChessBoardPromotionInline } from './chess-board-promotion';
import type {
  BoardOrientation,
  BoardTheme,
  Move,
  PieceCode,
  Square,
} from './chess-board-types';
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

function pieceCodeAtSquare(
  rows: ChessBoardCanvasContentProps['pieceRows'],
  sq: Square | null
): PieceCode | null {
  if (sq === null) return null;
  for (const row of rows) {
    if (row.square === sq) return row.code;
  }
  return null;
}

function useBoardWindowOrigin(hostLocal: boolean): {
  originX: ReturnType<typeof useSharedValue<number>>;
  originY: ReturnType<typeof useSharedValue<number>>;
  onLayout: (e: LayoutChangeEvent) => void;
  setNode: (n: View | null) => void;
  remountMeasure: () => void;
} {
  const nodeRef = useRef<View | null>(null);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const host = useOverlayPortalHostFrame();
  const hostLocalRef = useRef(hostLocal);
  hostLocalRef.current = hostLocal;
  const hostRef = useRef(host);
  hostRef.current = host;

  const remountMeasure = useCallback(() => {
    nodeRef.current?.measureInWindow((x, y) => {
      if (hostLocalRef.current) {
        const frame = hostRef.current;
        originX.value = x - frame.x;
        originY.value = y - frame.y;
      } else {
        originX.value = x;
        originY.value = y;
      }
    });
  }, [originX, originY]);

  const setNode = useCallback(
    (n: View | null) => {
      nodeRef.current = n;
      if (n !== null) remountMeasure();
    },
    [remountMeasure]
  );

  const onLayout = useCallback(() => {
    remountMeasure();
  }, [remountMeasure]);

  useEffect(() => {
    remountMeasure();
  }, [host.x, host.y, host.width, host.height, hostLocal, remountMeasure]);

  return { originX, originY, onLayout, setNode, remountMeasure };
}

/** Board surface: Skia chrome + pieces underlay + thin gesture surface + promotion. */
function ChessBoardViewImpl(p: ChessBoardViewProps): ReactNode {
  const { size, containerRef } = p;
  const hideDraggingPiece = useChessBoardPortalDragAvailable();
  const portal = useOverlayPortal();
  // OverlayPortal paints absoluteFill (host-local); iOS FullWindowOverlay is window-scoped.
  const hostLocalOrigin =
    Platform.OS !== 'ios' && portal !== null && hideDraggingPiece;
  const { originX, originY, onLayout, setNode, remountMeasure } =
    useBoardWindowOrigin(hostLocalOrigin);
  const dragFrom = p.contentProps.dragFrom;
  const dragCode = pieceCodeAtSquare(p.contentProps.pieceRows, dragFrom);

  useEffect(() => {
    if (dragFrom !== null) remountMeasure();
  }, [dragFrom, remountMeasure]);

  const setContainerRef = useCallback(
    (n: View | null) => {
      setNode(n);
      containerRef(n);
    },
    [containerRef, setNode]
  );

  const contentProps: ChessBoardCanvasContentProps = {
    ...p.contentProps,
    hideDraggingPiece,
  };

  const sqStyle = { width: size, height: size, overflow: 'visible' as const };
  return (
    <Box
      ref={setContainerRef}
      sx={sqStyle}
      onLayout={onLayout}
      {...p.userArrowsWebHandlers}
    >
      <Box sx={sqStyle}>
        <ChessBoardCanvasContent {...contentProps} />
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
      </Box>
      <ChessBoardDragPreview
        drag={p.contentProps.drag}
        boardOriginX={originX}
        boardOriginY={originY}
        pieceCode={dragCode}
        pieceSize={p.pieceDraw}
        enabled={hideDraggingPiece}
      />
    </Box>
  );
}

export const ChessBoardView = memo(ChessBoardViewImpl);
