import { useLayoutEffect, useRef } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { CHESS_PIECE_MOVE_MS } from './chess-board-piece';

const REST_Z = 2;

const MOVE_EASING = Easing.out(Easing.cubic);

function seedOrAnimate(
  sv: SharedValue<number>,
  next: number,
  instant: boolean
): void {
  if (instant) {
    sv.value = next;
    return;
  }
  sv.value = withTiming(next, {
    duration: CHESS_PIECE_MOVE_MS,
    easing: MOVE_EASING,
  });
}

export type ChessBoardPieceMotion = {
  leftSV: SharedValue<number>;
  topSV: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  scaleSV: SharedValue<number>;
  zSV: SharedValue<number>;
  elevSV: SharedValue<number>;
  wrapStyle: ReturnType<typeof useAnimatedStyle>;
  /** Scale only the glyph — must NOT wrap pan translate (causes drift). */
  liftStyle: ReturnType<typeof useAnimatedStyle>;
  /** Call from JS after a successful user drop so left/top seed instantly. */
  markSnapAfterDrag: () => void;
};

/** Resting left/top slide + pan translate; lift scale is glyph-only. */
export function useChessBoardPieceMotion(args: {
  left: number;
  top: number;
}): ChessBoardPieceMotion {
  const { left, top } = args;
  const leftSV = useSharedValue(left);
  const topSV = useSharedValue(top);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scaleSV = useSharedValue(1);
  const zSV = useSharedValue(REST_Z);
  const elevSV = useSharedValue(0);
  const firstRef = useRef(true);
  const snapAfterDragRef = useRef(false);

  useLayoutEffect(() => {
    const snap = firstRef.current || snapAfterDragRef.current;
    firstRef.current = false;
    snapAfterDragRef.current = false;
    if (snap) {
      // Atomic: destination layout + clear drag offset before paint.
      leftSV.value = left;
      topSV.value = top;
      tx.value = 0;
      ty.value = 0;
      return;
    }
    seedOrAnimate(leftSV, left, false);
    seedOrAnimate(topSV, top, false);
  }, [left, top, leftSV, topSV, tx, ty]);

  const markSnapAfterDrag = (): void => {
    snapAfterDragRef.current = true;
  };

  const wrapStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: leftSV.value,
    top: topSV.value,
    zIndex: zSV.value,
    elevation: elevSV.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  const liftStyle = useAnimatedStyle(() => ({
    width: '100%' as const,
    height: '100%' as const,
    transform: [{ scale: scaleSV.value }],
  }));

  return {
    leftSV,
    topSV,
    tx,
    ty,
    scaleSV,
    zSV,
    elevSV,
    wrapStyle,
    liftStyle,
    markSnapAfterDrag,
  };
}
