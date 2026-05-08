/* eslint-disable max-lines-per-function */
import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import type { BoardOrientation, Move, Position, Square } from './chess-board-types';
import { xyToSquare } from './chess-board-geometry';

export type BoardGesturesArgs = {
  size: number;
  orientation: BoardOrientation;
  interactive: boolean;
  position: Position;
  turn: 'w' | 'b';
  selected: Square | null;
  dragFrom: Square | null;
  legalTargets: readonly Square[];
  setSelected: (sq: Square | null) => void;
  onDragStart: (from: Square, xy: { x: number; y: number }) => void;
  onDragMove: (xy: { x: number; y: number }) => void;
  onDragEnd: () => void;
  onCommitMove: (m: { from: Square; to: Square; promotion?: Move['promotion'] }) => void;
};

function indexFromSquare(square: Square): number {
  return (
    (square.charCodeAt(1) - '1'.charCodeAt(0)) * 8 +
    (square.charCodeAt(0) - 'a'.charCodeAt(0))
  );
}

export function useBoardGestures(args: BoardGesturesArgs) {
  const {
    size,
    orientation,
    interactive,
    position,
    turn,
    selected,
    dragFrom,
    legalTargets,
    setSelected,
    onDragStart,
    onDragMove,
    onDragEnd,
    onCommitMove,
  } = args;

  return useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .enabled(interactive)
      .onEnd((e) => {
        const sq = xyToSquare(e.x, e.y, size, orientation);
        if (sq === null) return;

        if (selected === null) {
          const p = position[indexFromSquare(sq)] ?? null;
          if (p && p.color === turn) setSelected(sq);
          return;
        }

        if (sq === selected) {
          setSelected(null);
          return;
        }

        if (legalTargets.includes(sq)) {
          onCommitMove({ from: selected, to: sq });
        }
        setSelected(null);
      });

    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(interactive)
      .onBegin((e) => {
        const sq = xyToSquare(e.x, e.y, size, orientation);
        if (sq === null) return;
        const p = position[indexFromSquare(sq)] ?? null;
        if (!p || p.color !== turn) return;
        setSelected(sq);
        onDragStart(sq, { x: e.x, y: e.y });
      })
      .onUpdate((e) => {
        if (dragFrom !== null) onDragMove({ x: e.x, y: e.y });
      })
      .onEnd((e) => {
        const toSq = xyToSquare(e.x, e.y, size, orientation);
        const fromSq = dragFrom;
        onDragEnd();
        setSelected(null);
        if (toSq === null) return;
        if (fromSq === null) return;
        if (fromSq === toSq) return;
        onCommitMove({ from: fromSq, to: toSq });
      })
      .onFinalize(() => {
        onDragEnd();
      });

    return Gesture.Race(pan, tap);
  }, [
    interactive,
    legalTargets,
    onCommitMove,
    onDragEnd,
    onDragMove,
    onDragStart,
    orientation,
    position,
    selected,
    dragFrom,
    setSelected,
    size,
    turn,
  ]);
}

