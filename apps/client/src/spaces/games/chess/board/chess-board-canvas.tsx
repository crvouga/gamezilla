/* eslint-disable lingui/no-unlocalized-strings */
/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
import { GestureDetector } from 'react-native-gesture-handler';
import {
  Canvas,
  Group,
  ImageSVG,
  Rect,
  Skia,
  Text as SkiaText,
} from '@shopify/react-native-skia';
import { useMemo, useState, type ReactNode } from 'react';
import type {
  BoardTheme,
  ChessBoardProps,
  Move,
  Square,
} from './chess-board-types';
import { useChessGame } from './use-chess-game';
import { squareFromIndex, squareToXY } from './chess-board-geometry';
import { pieceCode } from './chess-pieces-svg';
import { usePieceSkiaSvgs } from './chess-pieces-cache';
import { useBoardGestures } from './chess-board-gestures';
import { ChessBoardPromotionModal } from './chess-board-promotion';
import {
  hapticError,
  hapticSelection,
  hapticSuccess,
} from './chess-board-haptics';

// #region agent log
fetch('http://127.0.0.1:7510/ingest/c52c9028-9c01-42a4-9186-01f9b18984a5', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Debug-Session-Id': '667087',
  },
  body: JSON.stringify({
    sessionId: '667087',
    hypothesisId: 'H1',
    location: 'chess-board-canvas.tsx:module-load',
    message: 'Skia symbol at module load',
    data: {
      skiaIsUndefined: typeof Skia === 'undefined',
      skiaType: typeof Skia,
      skiaTruthy: !!Skia,
      hasFont: !!(Skia && (Skia as { Font?: unknown }).Font),
      hasCanvasKitGlobal:
        typeof globalThis !== 'undefined' &&
        typeof (globalThis as { CanvasKit?: unknown }).CanvasKit !==
          'undefined',
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

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

  // #region agent log
  fetch('http://127.0.0.1:7510/ingest/c52c9028-9c01-42a4-9186-01f9b18984a5', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '667087',
    },
    body: JSON.stringify({
      sessionId: '667087',
      hypothesisId: 'H1',
      location: 'chess-board-canvas.tsx:render-entry',
      message: 'ChessBoardCanvas render entry',
      data: {
        skiaIsUndefined: typeof Skia === 'undefined',
        skiaTruthy: !!Skia,
        hasFont: !!(Skia && (Skia as { Font?: unknown }).Font),
        hasCanvasKitGlobal:
          typeof globalThis !== 'undefined' &&
          typeof (globalThis as { CanvasKit?: unknown }).CanvasKit !==
            'undefined',
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const game = useChessGame({ ...(fen ? { initialFen: fen } : {}) });
  const { position, lastMove, inCheck, turn } = game;

  const pieceSvgs = usePieceSkiaSvgs();
  const cell = size / 8;

  const [selected, setSelected] = useState<Square | null>(null);
  const [dragFrom, setDragFrom] = useState<Square | null>(null);
  const [dragXY, setDragXY] = useState<{ x: number; y: number } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const legalTargets = useMemo(() => {
    if (!highlightLegalMoves || selected === null)
      return [] as readonly Square[];
    return game.legalMovesFrom(selected);
  }, [game, highlightLegalMoves, selected]);

  const gesture = useBoardGestures({
    size,
    orientation,
    interactive,
    position,
    turn,
    selected,
    dragFrom,
    legalTargets,
    setSelected,
    onDragStart: (from, xy) => {
      setDragFrom(from);
      setDragXY(xy);
    },
    onDragMove: (xy) => {
      setDragXY(xy);
    },
    onDragEnd: () => {
      setDragFrom(null);
      setDragXY(null);
    },
    onCommitMove: ({ from, to, promotion }) => {
      if (!promotion && game.moveRequiresPromotion(from, to)) {
        setPendingPromotion({ from, to });
        return;
      }
      const res = game.tryMove({
        from,
        to,
        ...(promotion ? { promotion } : {}),
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

  return (
    <GestureDetector gesture={gesture}>
      <>
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
                const { x, y } = squareToXY(checkKingSquare, size, orientation);
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

          {/* pieces */}
          {Array.from({ length: 64 }).map((_, i) => {
            const square = squareFromIndex(i);
            const p = position[i] ?? null;
            if (p === null) return null;
            if (dragFrom === square) return null;
            const code = pieceCode(p.color, p.type);
            if (code === null) return null;
            const svg = pieceSvgs[code];
            const { x, y } = squareToXY(square, size, orientation);
            return (
              <ImageSVG
                key={`p-${square}`}
                svg={svg}
                x={x}
                y={y}
                width={cell}
                height={cell}
              />
            );
          })}

          {/* dragged piece */}
          {dragFrom && dragXY
            ? (() => {
                const pIdx =
                  (dragFrom.charCodeAt(1) - '1'.charCodeAt(0)) * 8 +
                  (dragFrom.charCodeAt(0) - 'a'.charCodeAt(0));
                const p = position[pIdx] ?? null;
                if (!p) return null;
                const code = pieceCode(p.color, p.type);
                if (!code) return null;
                const svg = pieceSvgs[code];
                return (
                  <ImageSVG
                    svg={svg}
                    x={dragXY.x - cell / 2}
                    y={dragXY.y - cell / 2}
                    width={cell}
                    height={cell}
                  />
                );
              })()
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
