/* eslint-disable max-lines-per-function */
import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  runOnJS,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { BoardOrientation, Position, Square } from './chess-board-types';
import { indexFromSquare, xyToSquare } from './chess-board-geometry';

export type BoardGesturesArgs = {
  size: number;
  orientation: BoardOrientation;
  interactive: boolean;
  position: Position;
  turn: 'w' | 'b';
  selected: Square | null;
  legalTargets: readonly Square[];
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  dragPickupScale?: SharedValue<number>;
  dragPickupOpacity?: SharedValue<number>;
  setSelected: (sq: Square | null) => void;
  onDragStart: (from: Square) => void;
  onDragEnd: () => void;
  onDrop: (fromSq: Square, toSq: Square) => void;
};

export function useBoardGestures(args: BoardGesturesArgs) {
  const {
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
    onDragStart,
    onDragEnd,
    onDrop,
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
          onDrop(selected, sq);
        }
        setSelected(null);
      });

    const pan = Gesture.Pan()
      .enabled(interactive)
      .shouldCancelWhenOutside(false)
      .onBegin((e) => {
        'worklet';
        const sq = xyToSquare(e.x, e.y, size, orientation);
        if (sq === null) return;
        const p = position[indexFromSquare(sq)] ?? null;
        if (!p || p.color !== turn) return;

        dragX.value = e.x;
        dragY.value = e.y;
        isDragging.value = true;
        if (dragPickupScale) {
          dragPickupScale.value = withTiming(2, {
            duration: 120,
            easing: Easing.out(Easing.cubic),
          });
        }
        if (dragPickupOpacity) {
          dragPickupOpacity.value = withTiming(0.95, {
            duration: 120,
            easing: Easing.out(Easing.cubic),
          });
        }

        runOnJS(setSelected)(sq);
        runOnJS(onDragStart)(sq);
      })
      .onUpdate((e) => {
        'worklet';
        if (isDragging.value) {
          dragX.value = e.x;
          dragY.value = e.y;
        }
      })
      .onEnd((e) => {
        'worklet';
        if (!isDragging.value) return;
        if (dragPickupScale) {
          dragPickupScale.value = withTiming(1, {
            duration: 140,
            easing: Easing.out(Easing.cubic),
          });
        }
        if (dragPickupOpacity) {
          dragPickupOpacity.value = withTiming(1, {
            duration: 140,
            easing: Easing.out(Easing.cubic),
          });
        }
        isDragging.value = false;

        const toSq = xyToSquare(e.x, e.y, size, orientation);
        const startX = e.x - e.translationX;
        const startY = e.y - e.translationY;
        const startSq = xyToSquare(startX, startY, size, orientation);

        runOnJS(onDragEnd)();
        runOnJS(setSelected)(null);

        if (toSq !== null && startSq !== null && startSq !== toSq) {
          runOnJS(onDrop)(startSq, toSq);
        }
      })
      .onFinalize(() => {
        'worklet';
        if (isDragging.value) {
          if (dragPickupScale) {
            dragPickupScale.value = withTiming(1, {
              duration: 140,
              easing: Easing.out(Easing.cubic),
            });
          }
          if (dragPickupOpacity) {
            dragPickupOpacity.value = withTiming(1, {
              duration: 140,
              easing: Easing.out(Easing.cubic),
            });
          }
          isDragging.value = false;
          runOnJS(onDragEnd)();
        }
      });

    return Gesture.Race(pan, tap);
  }, [
    interactive,
    legalTargets,
    onDrop,
    onDragEnd,
    onDragStart,
    orientation,
    position,
    selected,
    setSelected,
    size,
    turn,
    dragX,
    dragY,
    isDragging,
    dragPickupScale,
    dragPickupOpacity,
  ]);
}
