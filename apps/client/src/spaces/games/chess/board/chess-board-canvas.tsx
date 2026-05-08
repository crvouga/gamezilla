/* eslint-disable lingui/no-unlocalized-strings */
/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
import { GestureDetector } from 'react-native-gesture-handler';
import {
  Canvas,
  FilterMode,
  Group,
  Image,
  MipmapMode,
  Rect,
  Skia,
  Text as SkiaText,
} from '@shopify/react-native-skia';
import { useMemo, useState, type ReactNode } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type {
  BoardTheme,
  ChessBoardProps,
  Move,
  Square,
} from './chess-board-types';
import { useChessGame } from './use-chess-game';
import {
  indexFromSquare,
  squareFromIndex,
  squareToXY,
} from './chess-board-geometry';
import { pieceCode } from './chess-pieces-svg';
import { usePieceSkiaImages } from './chess-pieces-cache';
import { useBoardGestures } from './chess-board-gestures';
import { ChessBoardPromotionModal } from './chess-board-promotion';
import {
  hapticError,
  hapticSelection,
  hapticSuccess,
} from './chess-board-haptics';

export type ChessBoardCanvasProps = Required<
  Pick<
    ChessBoardProps,
    | 'orientation'
    | 'interactive'
    | 'showCoordinates'
    | 'highlightLastMove'
    | 'highlightLegalMoves'
  >
> & {
  fen?: string;
  onMove?: (m: Move) => void;
  size: number;
  theme: BoardTheme;
};

export function ChessBoardCanvas(props: ChessBoardCanvasProps): ReactNode {
  const {
    fen,
    onMove,
    orientation,
    interactive,
    showCoordinates,
    highlightLastMove,
    highlightLegalMoves,
    size,
    theme,
  } = props;

  const game = useChessGame({ ...(fen ? { initialFen: fen } : {}) });
  const { position, lastMove, inCheck, turn } = game;

  const pieceImages = usePieceSkiaImages();
  const cell = size / 8;
  const [selected, setSelected] = useState<Square | null>(null);
  const [dragFrom, setDragFrom] = useState<Square | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const draggedPieceStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      left: dragX.value - cell / 2,
      top: dragY.value - cell / 2,
      width: cell,
      height: cell,
      opacity: isDragging.value ? 1 : 0,
    };
  });

  const legalTargets = useMemo(() => {
    if (!highlightLegalMoves || selected === null)
      return [] as readonly Square[];
    return game.legalMovesFrom(selected);
  }, [game, highlightLegalMoves, selected]);

  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

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
    setSelected,
    onDragStart: (from) => {
      setDragFrom(from);
    },
    onDragEnd: () => {
      setDragFrom(null);
    },
    onDrop: (fromSq, toSq) => {
      if (!game.moveRequiresPromotion(fromSq, toSq)) {
        const res = game.tryMove({
          from: fromSq,
          to: toSq,
        });
        if (!res.ok) {
          hapticError();
          return;
        }
        if (res.move.captured || game.inCheck) {
          hapticSuccess();
        } else {
          hapticSelection();
        }
        onMove?.(res.move);
      } else {
        setPendingPromotion({ from: fromSq, to: toSq });
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

  const draggedPiece = dragFrom
    ? (() => {
        const p = position[indexFromSquare(dragFrom)] ?? null;
        if (!p) return null;
        const code = pieceCode(p.color, p.type);
        if (!code) return null;
        return { code };
      })()
    : null;

  return (
    <GestureDetector gesture={gesture}>
      <>
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

            {/* legal move dots */}
            {highlightLegalMoves
              ? legalTargets.map((sq) => {
                  const { x, y } = squareToXY(sq, size, orientation);
                  return (
                    <Rect
                      key={`dot-${sq}`}
                      x={x + cell * 0.4}
                      y={y + cell * 0.4}
                      width={cell * 0.2}
                      height={cell * 0.2}
                      color={theme.legalMoveDot}
                      opacity={0.6}
                    />
                  );
                })
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

            {/* pieces (pre-rasterized high-res Skia images for sharp downscaling) */}
            {pieceImages
              ? Array.from({ length: 64 }).map((_, i) => {
                  const square = squareFromIndex(i);
                  const p = position[i] ?? null;
                  if (p === null) return null;
                  if (dragFrom === square) return null;
                  const code = pieceCode(p.color, p.type);
                  if (code === null) return null;
                  const image = pieceImages[code];
                  const { x, y } = squareToXY(square, size, orientation);
                  return (
                    <Image
                      key={`p-${square}`}
                      image={image}
                      x={x}
                      y={y}
                      width={cell}
                      height={cell}
                      sampling={{
                        filter: FilterMode.Linear,
                        mipmap: MipmapMode.Linear,
                      }}
                    />
                  );
                })
              : null}

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

          {draggedPiece && pieceImages ? (
            <Animated.View pointerEvents="none" style={draggedPieceStyle}>
              <Canvas style={{ width: cell, height: cell }}>
                <Image
                  image={pieceImages[draggedPiece.code]}
                  x={0}
                  y={0}
                  width={cell}
                  height={cell}
                  sampling={{
                    filter: FilterMode.Linear,
                    mipmap: MipmapMode.Linear,
                  }}
                />
              </Canvas>
            </Animated.View>
          ) : null}
        </Animated.View>
        <ChessBoardPromotionModal
          visible={pendingPromotion !== null}
          onCancel={() => {
            setPendingPromotion(null);
            hapticSelection();
          }}
          onPick={(p) => {
            const pending = pendingPromotion;
            if (!pending) return;
            setPendingPromotion(null);
            const res = game.tryMove({
              from: pending.from,
              to: pending.to,
              promotion: p,
            });
            if (!res.ok) {
              hapticError();
              return;
            }
            if (res.move.captured || game.inCheck) {
              hapticSuccess();
            } else {
              hapticSelection();
            }
            onMove?.(res.move);
          }}
        />
      </>
    </GestureDetector>
  );
}
