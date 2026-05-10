/* eslint-disable lingui/no-unlocalized-strings */
/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
import {
  Canvas,
  Circle,
  FilterMode,
  Group,
  Image,
  MipmapMode,
  Rect,
  Skia,
  Text as SkiaText,
} from '@shopify/react-native-skia';
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { ChessBoardArrows } from './chess-board-arrows';
import { ChessBoardFeedback } from './chess-board-feedback';
import {
  indexFromSquare,
  squareFromIndex,
  squareToXY,
} from './chess-board-geometry';
import { useBoardGestures } from './chess-board-gestures';
import {
  hapticError,
  hapticSelection,
  hapticSuccess,
} from './chess-board-haptics';
import { ChessBoardPieceSkia, PIECE_DRAW_SCALE } from './chess-board-piece';
import { useChessPieceRows } from './chess-board-piece-identities';
import {
  ChessBoardPromotionInline,
  ChessBoardPromotionModal,
} from './chess-board-promotion';
import { useChessBoardSounds } from './chess-board-sounds';
import type {
  BoardArrow,
  BoardTheme,
  ChessBoardProps,
  Move,
  PieceColor,
  Square,
} from './chess-board-types';
import { usePieceSkiaImages } from './chess-pieces-cache';
import { pieceCode } from './chess-pieces-svg';
import { useChessBoardApplyMoveSound } from './use-chess-board-apply-move-sound';
import { useChessBoardCaptureGhost } from './use-chess-board-capture-ghost';
import { useChessBoardDragOverlay } from './use-chess-board-drag-overlay';
import {
  moveRequiresPromotionOnFen,
  tryMoveOnFen,
  type TryMoveResult,
  useChessGame,
} from './use-chess-game';
import { useExternalFenSync } from './use-external-fen-sync';
import { useUserArrows } from './use-user-arrows';

/**
 * Controlled boards validate on a copy (`tryMoveOnFen`) but must still apply
 * the ply to the live `useChessGame` instance so `lastMove` + `position` feed
 * `useChessPieceRows` / piece slide animations; parent `fen` then replaces via
 * `useExternalFenSync` (e.g. engine reply).
 */
function applyPlyForBoardUi(
  rulesFen: string | undefined,
  tryMove: (m: {
    from: Square;
    to: Square;
    promotion?: Move['promotion'];
  }) => TryMoveResult,
  m: { from: Square; to: Square; promotion?: Move['promotion'] }
): TryMoveResult {
  if (rulesFen !== undefined) {
    const dry = tryMoveOnFen(rulesFen, m);
    if (!dry.ok) return dry;
    return tryMove(m);
  }
  return tryMove(m);
}

export type ChessBoardCanvasProps = Required<
  Pick<
    ChessBoardProps,
    | 'orientation'
    | 'interactive'
    | 'showCoordinates'
    | 'highlightLastMove'
    | 'highlightLegalMoves'
    | 'promotionStyle'
    | 'dragOverlayPortal'
    | 'enableUserArrows'
  >
> & {
  fen?: string;
  onMove?: (m: Move) => void;
  controlled?: boolean;
  fenSyncKey?: number;
  size: number;
  theme: BoardTheme;
  cellFeedback?: ChessBoardProps['cellFeedback'];
  cellHighlights?: ChessBoardProps['cellHighlights'];
  arrows?: readonly BoardArrow[];
  onUserArrowsChange?: ChessBoardProps['onUserArrowsChange'];
};

type DraggedPieceLayerProps = {
  pieceImages: ReturnType<typeof usePieceSkiaImages>;
  draggedPieceCode: ReturnType<typeof pieceCode> | null;
  dragX: ReturnType<typeof useSharedValue<number>>;
  dragY: ReturnType<typeof useSharedValue<number>>;
  isDragging: ReturnType<typeof useSharedValue<boolean>>;
  dragPickupOpacity: ReturnType<typeof useSharedValue<number>>;
  dragPickupScale: ReturnType<typeof useSharedValue<number>>;
  pieceDraw: number;
  /** When provided, the layer renders at `screen` coords (origin + drag). */
  origin?: { x: number; y: number };
};

const DraggedPieceLayer = forwardRef<View, DraggedPieceLayerProps>(
  function DraggedPieceLayer(props, ref) {
    const {
      pieceImages,
      draggedPieceCode,
      dragX,
      dragY,
      isDragging,
      dragPickupOpacity,
      dragPickupScale,
      pieceDraw,
      origin,
    } = props;

    const offsetX = origin?.x ?? 0;
    const offsetY = origin?.y ?? 0;

    const draggedStyle = useAnimatedStyle(() => ({
      position: 'absolute',
      left: offsetX + dragX.value - pieceDraw / 2,
      top: offsetY + dragY.value - pieceDraw / 2,
      width: pieceDraw,
      height: pieceDraw,
      opacity: isDragging.value ? dragPickupOpacity.value : 0,
      transform: [{ scale: dragPickupScale.value }],
    }));

    if (!pieceImages || draggedPieceCode === null) return null;

    const image = pieceImages[draggedPieceCode];

    return (
      <Animated.View ref={ref} pointerEvents="none" style={draggedStyle}>
        <Canvas style={{ width: pieceDraw, height: pieceDraw }}>
          <Image
            image={image}
            x={0}
            y={0}
            width={pieceDraw}
            height={pieceDraw}
            sampling={{
              filter: FilterMode.Linear,
              mipmap: MipmapMode.Linear,
            }}
          />
        </Canvas>
      </Animated.View>
    );
  }
);

/* eslint-disable-next-line max-statements -- Skia board: layout, gestures, promotion, FEN sync, overlays. */
export function ChessBoardCanvas(props: ChessBoardCanvasProps): ReactNode {
  const {
    fen,
    onMove,
    controlled = false,
    fenSyncKey,
    orientation,
    interactive,
    showCoordinates,
    highlightLastMove,
    highlightLegalMoves,
    promotionStyle,
    dragOverlayPortal,
    enableUserArrows,
    cellFeedback,
    cellHighlights,
    arrows: externalArrows,
    onUserArrowsChange,
    size,
    theme,
  } = props;

  const rulesFen =
    controlled && fen !== undefined && fen.length > 0 ? fen : undefined;

  const game = useChessGame({ ...(fen ? { initialFen: fen } : {}) });
  const { position, lastMove, inCheck, turn, reset } = game;

  const { captureGhost } = useChessBoardCaptureGhost(position, lastMove);

  const sounds = useChessBoardSounds();
  const pieceImages = usePieceSkiaImages();
  const cell = size / 8;
  const pieceDraw = cell * PIECE_DRAW_SCALE;

  const { active: pieceRows } = useChessPieceRows(position, lastMove);

  const [selected, setSelected] = useState<Square | null>(null);
  const [dragFrom, setDragFrom] = useState<Square | null>(null);
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const dragPickupScale = useSharedValue(1);
  const dragPickupOpacity = useSharedValue(1);

  const legalTargets = useMemo(() => {
    if (!highlightLegalMoves || selected === null)
      return [] as readonly Square[];
    return game.legalMovesFrom(selected);
  }, [game, highlightLegalMoves, selected]);

  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
    color: PieceColor;
  } | null>(null);

  const clearBoardInteraction = useCallback(() => {
    setSelected(null);
    setDragFrom(null);
    setHoveredSquare(null);
    setPendingPromotion(null);
  }, []);

  useExternalFenSync(fen, fenSyncKey, reset, clearBoardInteraction);

  const applySuccessfulMove = useChessBoardApplyMoveSound(sounds);

  const gesture = useBoardGestures({
    size,
    orientation,
    interactive,
    position,
    turn,
    selected,
    legalTargets,
    dragX,
    dragY,
    isDragging,
    dragPickupScale,
    dragPickupOpacity,
    setSelected,
    onDragStart: (from) => {
      setDragFrom(from);
    },
    onDragEnd: () => {
      setDragFrom(null);
      setHoveredSquare(null);
    },
    onHoverSquare: (sq) => {
      setHoveredSquare(sq);
    },
    onDrop: (fromSq, toSq) => {
      const needsPromotion = rulesFen
        ? moveRequiresPromotionOnFen(rulesFen, fromSq, toSq)
        : game.moveRequiresPromotion(fromSq, toSq);
      if (!needsPromotion) {
        const res = applyPlyForBoardUi(rulesFen, game.tryMove, {
          from: fromSq,
          to: toSq,
        });
        if (!res.ok) {
          sounds.playIllegal();
          hapticError();
          return;
        }
        if (res.move.captured || res.inCheck) {
          hapticSuccess();
        } else {
          hapticSelection();
        }
        applySuccessfulMove(res.move, {
          inCheck: res.inCheck,
          isGameOver: res.isGameOver,
        });
        onMove?.(res.move);
      } else {
        const moverColor = position[indexFromSquare(fromSq)]?.color ?? turn;
        setPendingPromotion({ from: fromSq, to: toSq, color: moverColor });
      }
    },
  });

  const font = useMemo(() => {
    const f = Skia.Font(undefined, Math.max(10, Math.floor(cell * 0.22)));
    return f;
  }, [cell]);

  const checkKingSquare = useMemo((): Square | null => {
    if (!inCheck) return null;
    for (let i = 0; i < 64; i++) {
      const p = position[i];
      if (p && p.type === 'k' && p.color === turn) return squareFromIndex(i);
    }
    return null;
  }, [inCheck, position, turn]);

  const draggedPieceCode = dragFrom
    ? (() => {
        const p = position[indexFromSquare(dragFrom)] ?? null;
        if (!p) return null;
        return pieceCode(p.color, p.type);
      })()
    : null;

  const dragOverlay = useChessBoardDragOverlay(dragOverlayPortal);

  /**
   * Combined ref for the outer board View — drives both the overlay portal's
   * `measureInWindow` source and the user-arrows DOM container.
   */
  const userArrows = useUserArrows({
    size,
    orientation,
    theme,
    enabled: enableUserArrows,
    ...(onUserArrowsChange !== undefined
      ? { onChange: onUserArrowsChange }
      : {}),
  });

  const composedContainerRef = useCallback(
    (node: View | null) => {
      dragOverlay.containerRef(node);
      userArrows.containerRef(node);
    },
    [dragOverlay, userArrows]
  );

  /**
   * When the portal is enabled we mount the dragged piece into the overlay
   * (via {@link useChessBoardDragOverlay}); otherwise we render it inline.
   */
  useEffect(() => {
    if (!dragOverlayPortal) {
      dragOverlay.setOverlayNode(null);
      return;
    }
    if (draggedPieceCode === null || pieceImages === null) {
      dragOverlay.setOverlayNode(null);
      return;
    }
    dragOverlay.setOverlayNode(
      <DraggedPieceLayer
        key="chess-drag-overlay"
        pieceImages={pieceImages}
        draggedPieceCode={draggedPieceCode}
        dragX={dragX}
        dragY={dragY}
        isDragging={isDragging}
        dragPickupOpacity={dragPickupOpacity}
        dragPickupScale={dragPickupScale}
        pieceDraw={pieceDraw}
        origin={dragOverlay.origin}
      />
    );
  }, [
    dragOverlay,
    dragOverlayPortal,
    dragPickupOpacity,
    dragPickupScale,
    dragX,
    dragY,
    draggedPieceCode,
    isDragging,
    pieceDraw,
    pieceImages,
  ]);

  const mergedArrows = useMemo<readonly BoardArrow[]>(() => {
    const ext = externalArrows ?? [];
    if (userArrows.arrows.length === 0) return ext;
    return [...ext, ...userArrows.arrows];
  }, [externalArrows, userArrows.arrows]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        ref={composedContainerRef}
        onLayout={dragOverlay.onContainerLayout}
        style={{ width: size, height: size, overflow: 'visible' }}
        {...userArrows.webEventHandlers}
      >
        <Animated.View
          style={{ width: size, height: size, overflow: 'visible' }}
        >
          <Canvas style={{ width: size, height: size }}>
            {/* squares */}
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

            {/* custom cell highlights (fill or ring) */}
            {cellHighlights
              ? Object.entries(cellHighlights).map(([sq, hl]) => {
                  if (hl === undefined) return null;
                  const { x, y } = squareToXY(sq as Square, size, orientation);
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
                })
              : null}

            {/* last move */}
            {highlightLastMove && lastMove ? (
              <>
                {([lastMove.from, lastMove.to] as const).map((sq) => {
                  const { x, y } = squareToXY(sq, size, orientation);
                  return (
                    <Rect
                      key={`lm-${sq}`}
                      x={x}
                      y={y}
                      width={cell}
                      height={cell}
                      color={theme.lastMove}
                      opacity={0.35}
                    />
                  );
                })}
              </>
            ) : null}

            {/* selection */}
            {selected
              ? (() => {
                  const { x, y } = squareToXY(selected, size, orientation);
                  return (
                    <Rect
                      x={x}
                      y={y}
                      width={cell}
                      height={cell}
                      color={theme.selected}
                      opacity={0.45}
                    />
                  );
                })()
              : null}

            {/* legal move markers: dot (empty) or ring (capture) */}
            {highlightLegalMoves
              ? legalTargets.map((sq) => {
                  const { x, y } = squareToXY(sq, size, orientation);
                  const cx = x + cell / 2;
                  const cy = y + cell / 2;
                  const occupant = position[indexFromSquare(sq)] ?? null;
                  const isCapture =
                    occupant !== null && occupant?.color !== turn;
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
                })
              : null}

            {/* hovered cell indicator */}
            {hoveredSquare
              ? (() => {
                  const { x, y } = squareToXY(hoveredSquare, size, orientation);
                  const stroke = Math.max(2, cell * 0.08);
                  const inset = stroke / 2;
                  return (
                    <Rect
                      x={x + inset}
                      y={y + inset}
                      width={cell - stroke}
                      height={cell - stroke}
                      color={theme.selected}
                      style="stroke"
                      strokeWidth={stroke}
                      opacity={0.85}
                    />
                  );
                })()
              : null}

            {/* check */}
            {checkKingSquare
              ? (() => {
                  const { x, y } = squareToXY(
                    checkKingSquare,
                    size,
                    orientation
                  );
                  return (
                    <Rect
                      x={x}
                      y={y}
                      width={cell}
                      height={cell}
                      color={theme.check}
                      opacity={0.28}
                    />
                  );
                })()
              : null}

            {/* Captured piece stays until attacker slide finishes (see CHESS_PIECE_MOVE_MS). */}
            {pieceImages && captureGhost
              ? (() => {
                  const image = pieceImages[captureGhost.code];
                  if (!image) return null;
                  const { x, y } = squareToXY(
                    captureGhost.square,
                    size,
                    orientation
                  );
                  const cx = x + cell / 2 + cell * 0.042;
                  const cy = y + cell / 2 + cell * 0.012;
                  return (
                    <ChessBoardPieceSkia
                      key="capture-ghost"
                      image={image}
                      pieceSize={pieceDraw}
                      targetCenterX={cx}
                      targetCenterY={cy}
                    />
                  );
                })()
              : null}

            {/* active pieces */}
            {pieceImages
              ? pieceRows.map((row) => {
                  if (dragFrom === row.square) return null;
                  const { x, y } = squareToXY(row.square, size, orientation);
                  const cx = x + cell / 2 + cell * 0.042;
                  const cy = y + cell / 2 + cell * 0.012;
                  const image = pieceImages[row.code];
                  return (
                    <ChessBoardPieceSkia
                      key={row.id}
                      image={image}
                      pieceSize={pieceDraw}
                      targetCenterX={cx}
                      targetCenterY={cy}
                      fadeInOnMount={!!row.fadeIn}
                    />
                  );
                })
              : null}

            {/* arrows above pieces */}
            <ChessBoardArrows
              arrows={mergedArrows}
              size={size}
              orientation={orientation}
              theme={theme}
            />

            {/* feedback indicators above arrows */}
            <ChessBoardFeedback
              cellFeedback={cellFeedback}
              size={size}
              orientation={orientation}
              theme={theme}
            />

            {/* coordinates */}
            {showCoordinates && font ? (
              <Group>
                {Array.from({ length: 8 }).map((_, fileIdx) => {
                  const file = String.fromCharCode('a'.charCodeAt(0) + fileIdx);
                  const rank = String(8 - fileIdx);
                  const fileSq =
                    orientation === 'white'
                      ? (`${file}1` as Square)
                      : (`${String.fromCharCode('a'.charCodeAt(0) + (7 - fileIdx))}8` as Square);
                  const rankSq =
                    orientation === 'white'
                      ? (`a${rank}` as Square)
                      : (`h${String(fileIdx + 1)}` as Square);

                  const filePos = squareToXY(fileSq, size, orientation);
                  const rankPos = squareToXY(rankSq, size, orientation);

                  return (
                    <Group key={`coord-${fileIdx}`}>
                      <SkiaText
                        x={filePos.x + cell * 0.82}
                        y={filePos.y + cell * 0.95}
                        text={
                          orientation === 'white'
                            ? file
                            : String.fromCharCode(
                                'a'.charCodeAt(0) + (7 - fileIdx)
                              )
                        }
                        font={font}
                        color={theme.coordinates}
                        opacity={0.75}
                      />
                      <SkiaText
                        x={rankPos.x + cell * 0.08}
                        y={rankPos.y + cell * 0.25}
                        text={
                          orientation === 'white' ? rank : String(fileIdx + 1)
                        }
                        font={font}
                        color={theme.coordinates}
                        opacity={0.75}
                      />
                    </Group>
                  );
                })}
              </Group>
            ) : null}
          </Canvas>

          {/* Inline-rendered drag piece (when not using overlay portal). */}
          {!dragOverlayPortal ? (
            <DraggedPieceLayer
              pieceImages={pieceImages}
              draggedPieceCode={draggedPieceCode}
              dragX={dragX}
              dragY={dragY}
              isDragging={isDragging}
              dragPickupOpacity={dragPickupOpacity}
              dragPickupScale={dragPickupScale}
              pieceDraw={pieceDraw}
            />
          ) : null}

          {/* Inline promotion picker (default). */}
          {promotionStyle === 'inline' && pendingPromotion !== null ? (
            <ChessBoardPromotionInline
              color={pendingPromotion.color}
              to={pendingPromotion.to}
              size={size}
              orientation={orientation}
              theme={theme}
              pieceImages={pieceImages}
              onCancel={() => {
                setPendingPromotion(null);
                hapticSelection();
              }}
              onPick={(p) => {
                handlePromotionPick({
                  pending: pendingPromotion,
                  promotion: p,
                  rulesFen,
                  game,
                  sounds,
                  applySuccessfulMove,
                  onMove,
                  setPendingPromotion,
                });
              }}
            />
          ) : null}
        </Animated.View>

        {/* Modal promotion picker (legacy fallback). */}
        {promotionStyle === 'modal' ? (
          <ChessBoardPromotionModal
            visible={pendingPromotion !== null}
            onCancel={() => {
              setPendingPromotion(null);
              hapticSelection();
            }}
            onPick={(p) => {
              if (pendingPromotion === null) return;
              handlePromotionPick({
                pending: pendingPromotion,
                promotion: p,
                rulesFen,
                game,
                sounds,
                applySuccessfulMove,
                onMove,
                setPendingPromotion,
              });
            }}
          />
        ) : null}
      </View>
    </GestureDetector>
  );
}

type GameLike = ReturnType<typeof useChessGame>;
type SoundsLike = ReturnType<typeof useChessBoardSounds>;
type ApplyMoveSoundLike = ReturnType<typeof useChessBoardApplyMoveSound>;

type HandlePromotionPickArgs = {
  pending: { from: Square; to: Square; color: PieceColor };
  promotion: NonNullable<Move['promotion']>;
  rulesFen: string | undefined;
  game: GameLike;
  sounds: SoundsLike;
  applySuccessfulMove: ApplyMoveSoundLike;
  onMove: ((m: Move) => void) | undefined;
  setPendingPromotion: (
    next: { from: Square; to: Square; color: PieceColor } | null
  ) => void;
};

function handlePromotionPick(args: HandlePromotionPickArgs): void {
  const {
    pending,
    promotion,
    rulesFen,
    game,
    sounds,
    applySuccessfulMove,
    onMove,
    setPendingPromotion,
  } = args;
  setPendingPromotion(null);
  const res = applyPlyForBoardUi(rulesFen, game.tryMove, {
    from: pending.from,
    to: pending.to,
    promotion,
  });
  if (!res.ok) {
    sounds.playIllegal();
    hapticError();
    return;
  }
  if (res.move.captured || res.inCheck) {
    hapticSuccess();
  } else {
    hapticSelection();
  }
  applySuccessfulMove(res.move, {
    inCheck: res.inCheck,
    isGameOver: res.isGameOver,
  });
  onMove?.(res.move);
}
