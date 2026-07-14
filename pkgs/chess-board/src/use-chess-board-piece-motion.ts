import { useEffect, useRef } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { CHESS_PIECE_MOVE_MS } from './chess-board-piece';

const DRAG_SCALE = 1.22;
const REST_Z = 2;
const DRAG_Z = 1000;
const DRAG_ELEVATION = 24;

const MOVE_EASING = Easing.out(Easing.cubic);

function seedOrAnimate(
  sv: SharedValue<number>,
  next: number,
  isFirst: boolean
): void {
  if (isFirst) {
    sv.value = next;
    return;
  }
  sv.value = withTiming(next, {
    duration: CHESS_PIECE_MOVE_MS,
    easing: MOVE_EASING,
  });
}

type MotionStyles = {
  layoutStyle: ReturnType<typeof useAnimatedStyle>;
  /** Scale only the glyph — must NOT wrap Draggable translate (causes drift). */
  liftStyle: ReturnType<typeof useAnimatedStyle>;
  onDragStartMotion: () => void;
  onDragEndMotion: () => void;
};

/** Animates resting cell layout; lift scale is separate from drag translate. */
export function useChessBoardPieceMotion(args: {
  left: number;
  top: number;
}): MotionStyles {
  const { left, top } = args;
  const leftSV = useSharedValue(left);
  const topSV = useSharedValue(top);
  const scaleSV = useSharedValue(1);
  const zSV = useSharedValue(REST_Z);
  const elevSV = useSharedValue(0);
  const firstRef = useRef(true);

  useEffect(() => {
    const isFirst = firstRef.current;
    firstRef.current = false;
    seedOrAnimate(leftSV, left, isFirst);
    seedOrAnimate(topSV, top, isFirst);
  }, [left, top, leftSV, topSV]);

  const onDragStartMotion = (): void => {
    zSV.value = DRAG_Z;
    elevSV.value = DRAG_ELEVATION;
    scaleSV.value = withSpring(DRAG_SCALE, { damping: 16, stiffness: 220 });
  };
  const onDragEndMotion = (): void => {
    zSV.value = REST_Z;
    elevSV.value = 0;
    scaleSV.value = withSpring(1, { damping: 16, stiffness: 220 });
  };

  const layoutStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: leftSV.value,
    top: topSV.value,
    zIndex: zSV.value,
    elevation: elevSV.value,
  }));

  const liftStyle = useAnimatedStyle(() => ({
    width: '100%' as const,
    height: '100%' as const,
    transform: [{ scale: scaleSV.value }],
  }));

  return { layoutStyle, liftStyle, onDragStartMotion, onDragEndMotion };
}
