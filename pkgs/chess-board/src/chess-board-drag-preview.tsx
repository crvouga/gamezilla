import { Box, useOverlayPortal, useOverlayPortalSlot } from '@pkgs/ui';
import { memo, type ReactNode, useId } from 'react';
import { Platform } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { FullWindowOverlay } from 'react-native-screens';
import { SvgXml } from 'react-native-svg';
import {
  type ChessBoardDragMotion,
  DRAG_PIECE_NONE,
} from './chess-board-drag-motion';
import { DRAG_FEET_FROM_TOP } from './chess-board-piece';
import type { PieceCode } from './chess-board-types';
import { PIECE_SVGS } from './chess-pieces-svg';

export type ChessBoardDragPreviewProps = {
  drag: ChessBoardDragMotion;
  /** Window origin of the board's top-left corner. */
  boardOriginX: SharedValue<number>;
  boardOriginY: SharedValue<number>;
  pieceCode: PieceCode | null;
  pieceSize: number;
  /** When false, no ghost (caller keeps the in-canvas piece). */
  enabled: boolean;
};

type GhostStyleArgs = {
  drag: ChessBoardDragMotion;
  boardOriginX: SharedValue<number>;
  boardOriginY: SharedValue<number>;
  pieceSize: number;
};

function useGhostStyle(args: GhostStyleArgs) {
  const { drag, boardOriginX, boardOriginY, pieceSize } = args;
  return useAnimatedStyle(() => {
    const active = drag.pieceKey.value !== DRAG_PIECE_NONE;
    const feetY = pieceSize * DRAG_FEET_FROM_TOP;
    return {
      opacity: active ? 1 : 0,
      transform: [
        {
          translateX: boardOriginX.value + drag.tx.value - pieceSize / 2,
        },
        {
          translateY: boardOriginY.value + drag.ty.value - feetY,
        },
      ],
    };
  }, [boardOriginX, boardOriginY, drag, pieceSize]);
}

type GhostVisualProps = {
  pieceCode: PieceCode;
  pieceSize: number;
  style: ReturnType<typeof useGhostStyle>;
};

function DragGhostVisual(props: GhostVisualProps): ReactNode {
  const { pieceCode, pieceSize, style } = props;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 1,
          width: pieceSize,
          height: pieceSize,
        },
        style,
      ]}
    >
      <SvgXml
        xml={PIECE_SVGS[pieceCode]}
        width={pieceSize}
        height={pieceSize}
      />
    </Animated.View>
  );
}

/**
 * iOS: native-stack / Skia Metal views paint above a normal AbsoluteFill
 * portal. {@link FullWindowOverlay} hosts the ghost under the key window so
 * it stays visible (and Reanimated stays in this component tree).
 */
function IosDragPreview(props: {
  pieceCode: PieceCode;
  pieceSize: number;
  style: ReturnType<typeof useGhostStyle>;
}): ReactNode {
  return (
    <FullWindowOverlay>
      <Box
        pointerEvents="box-none"
        sx={{ absoluteFill: true }}
        collapsable={false}
      >
        <DragGhostVisual
          pieceCode={props.pieceCode}
          pieceSize={props.pieceSize}
          style={props.style}
        />
      </Box>
    </FullWindowOverlay>
  );
}

function useWebAndroidPortalGhost(args: {
  enabled: boolean;
  pieceCode: PieceCode | null;
  pieceSize: number;
  style: ReturnType<typeof useGhostStyle>;
}): void {
  const { enabled, pieceCode, pieceSize, style } = args;
  const portalId = useId();
  const portal = useOverlayPortal();
  const canPortal = enabled && portal !== null && pieceCode !== null;
  const node =
    canPortal && pieceCode !== null ? (
      <DragGhostVisual
        pieceCode={pieceCode}
        pieceSize={pieceSize}
        style={style}
      />
    ) : null;
  useOverlayPortalSlot(`chess-board-drag-${portalId}`, node, canPortal);
}

/**
 * Full-screen drag ghost. Skia Canvas clips to the board; the ghost must
 * live outside that surface (portal on web/android, FullWindowOverlay on iOS).
 */
function ChessBoardDragPreviewImpl(
  props: ChessBoardDragPreviewProps
): ReactNode {
  const { drag, boardOriginX, boardOriginY, pieceCode, pieceSize, enabled } =
    props;
  const style = useGhostStyle({
    drag,
    boardOriginX,
    boardOriginY,
    pieceSize,
  });

  const portalEnabled = enabled && Platform.OS !== 'ios';
  useWebAndroidPortalGhost({
    enabled: portalEnabled,
    pieceCode,
    pieceSize,
    style,
  });

  if (Platform.OS === 'ios' && enabled && pieceCode !== null) {
    return (
      <IosDragPreview
        pieceCode={pieceCode}
        pieceSize={pieceSize}
        style={style}
      />
    );
  }
  return null;
}

export const ChessBoardDragPreview = memo(ChessBoardDragPreviewImpl);

/**
 * Prefer escaping Skia clip with an external ghost. iOS always can
 * ({@link FullWindowOverlay}); other platforms need the app portal.
 */
export function useChessBoardPortalDragAvailable(): boolean {
  const portal = useOverlayPortal();
  if (Platform.OS === 'ios') return true;
  return portal !== null;
}
