import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  runOnJS,
  useSharedValue,
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
  onHoverSquare?: (sq: Square | null) => void;
  onDrop: (fromSq: Square, toSq: Square) => void;
};

const PICKUP_IN_MS = 120;
const PICKUP_OUT_MS = 140;
const PICKUP_SCALE = 1.8;
const PICKUP_OPACITY = 0.6;

function easeInCubic(): ReturnType<typeof Easing.out> {
  return Easing.out(Easing.cubic);
}

type PickupAnim = {
  scale: SharedValue<number> | undefined;
  opacity: SharedValue<number> | undefined;
  toScale: number;
  toOpacity: number;
  duration: number;
};

function animatePickup(p: PickupAnim): void {
  'worklet';
  if (p.scale) {
    p.scale.value = withTiming(p.toScale, {
      duration: p.duration,
      easing: easeInCubic(),
    });
  }
  if (p.opacity) {
    p.opacity.value = withTiming(p.toOpacity, {
      duration: p.duration,
      easing: easeInCubic(),
    });
  }
}

function pickupTo(
  ctx: {
    dragPickupScale?: SharedValue<number>;
    dragPickupOpacity?: SharedValue<number>;
  },
  toScale: number,
  toOpacity: number,
  duration: number
): void {
  'worklet';
  animatePickup({
    ...(ctx.dragPickupScale
      ? { scale: ctx.dragPickupScale }
      : { scale: undefined }),
    ...(ctx.dragPickupOpacity
      ? { opacity: ctx.dragPickupOpacity }
      : { opacity: undefined }),
    toScale,
    toOpacity,
    duration,
  });
}

type TapArgs = {
  interactive: boolean;
  size: number;
  orientation: BoardOrientation;
  position: Position;
  turn: 'w' | 'b';
  selected: Square | null;
  legalTargets: readonly Square[];
  setSelected: (sq: Square | null) => void;
  onDrop: (fromSq: Square, toSq: Square) => void;
};

function buildTapGesture(args: TapArgs) {
  const {
    interactive,
    size,
    orientation,
    position,
    turn,
    selected,
    legalTargets,
    setSelected,
    onDrop,
  } = args;
  return Gesture.Tap()
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
}

type PanContext = {
  size: number;
  orientation: BoardOrientation;
  position: Position;
  turn: 'w' | 'b';
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  dragPickupScale?: SharedValue<number>;
  dragPickupOpacity?: SharedValue<number>;
  lastHoverIndex: SharedValue<number>;
  setSelected: (sq: Square | null) => void;
  onDragStart: (from: Square) => void;
  onDragEnd: () => void;
  onHoverSquare?: (sq: Square | null) => void;
  onDrop: (fromSq: Square, toSq: Square) => void;
};

/** Encode `Square | null` as a number for SharedValue (worklets need primitives). */
const HOVER_NONE = -1;

function emitHover(
  ctx: PanContext,
  squareIdx: number,
  square: Square | null
): void {
  'worklet';
  if (ctx.lastHoverIndex.value === squareIdx) return;
  ctx.lastHoverIndex.value = squareIdx;
  if (ctx.onHoverSquare) {
    runOnJS(ctx.onHoverSquare)(square);
  }
}

function onPanBegin(ctx: PanContext, e: { x: number; y: number }): void {
  'worklet';
  const sq = xyToSquare(e.x, e.y, ctx.size, ctx.orientation);
  if (sq === null) return;
  const idx = indexFromSquare(sq);
  const p = ctx.position[idx] ?? null;
  if (!p || p.color !== ctx.turn) return;

  ctx.dragX.value = e.x;
  ctx.dragY.value = e.y;
  ctx.isDragging.value = true;
  pickupTo(ctx, PICKUP_SCALE, PICKUP_OPACITY, PICKUP_IN_MS);
  emitHover(ctx, idx, sq);
  runOnJS(ctx.setSelected)(sq);
  runOnJS(ctx.onDragStart)(sq);
}

function onPanUpdate(ctx: PanContext, e: { x: number; y: number }): void {
  'worklet';
  if (!ctx.isDragging.value) return;
  ctx.dragX.value = e.x;
  ctx.dragY.value = e.y;
  if (!ctx.onHoverSquare) return;
  const hoverSq = xyToSquare(e.x, e.y, ctx.size, ctx.orientation);
  const idx = hoverSq === null ? HOVER_NONE : indexFromSquare(hoverSq);
  emitHover(ctx, idx, hoverSq);
}

function onPanEnd(
  ctx: PanContext,
  e: { x: number; y: number; translationX: number; translationY: number }
): void {
  'worklet';
  if (!ctx.isDragging.value) return;
  pickupTo(ctx, 1, 1, PICKUP_OUT_MS);
  ctx.isDragging.value = false;

  const toSq = xyToSquare(e.x, e.y, ctx.size, ctx.orientation);
  const startX = e.x - e.translationX;
  const startY = e.y - e.translationY;
  const startSq = xyToSquare(startX, startY, ctx.size, ctx.orientation);

  ctx.lastHoverIndex.value = HOVER_NONE;
  runOnJS(ctx.onDragEnd)();
  if (ctx.onHoverSquare) {
    runOnJS(ctx.onHoverSquare)(null);
  }
  runOnJS(ctx.setSelected)(null);

  if (toSq !== null && startSq !== null && startSq !== toSq) {
    runOnJS(ctx.onDrop)(startSq, toSq);
  }
}

function onPanFinalize(ctx: PanContext): void {
  'worklet';
  if (!ctx.isDragging.value) return;
  pickupTo(ctx, 1, 1, PICKUP_OUT_MS);
  ctx.isDragging.value = false;
  ctx.lastHoverIndex.value = HOVER_NONE;
  runOnJS(ctx.onDragEnd)();
  if (ctx.onHoverSquare) {
    runOnJS(ctx.onHoverSquare)(null);
  }
}

function buildPanGesture(ctx: PanContext, interactive: boolean) {
  return Gesture.Pan()
    .enabled(interactive)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => {
      'worklet';
      onPanBegin(ctx, e);
    })
    .onUpdate((e) => {
      'worklet';
      onPanUpdate(ctx, e);
    })
    .onEnd((e) => {
      'worklet';
      onPanEnd(ctx, e);
    })
    .onFinalize(() => {
      'worklet';
      onPanFinalize(ctx);
    });
}

function buildPanContext(
  args: BoardGesturesArgs,
  lastHoverIndex: SharedValue<number>
): PanContext {
  const ctx: PanContext = {
    size: args.size,
    orientation: args.orientation,
    position: args.position,
    turn: args.turn,
    dragX: args.dragX,
    dragY: args.dragY,
    isDragging: args.isDragging,
    lastHoverIndex,
    setSelected: args.setSelected,
    onDragStart: args.onDragStart,
    onDragEnd: args.onDragEnd,
    onDrop: args.onDrop,
  };
  if (args.dragPickupScale) ctx.dragPickupScale = args.dragPickupScale;
  if (args.dragPickupOpacity) ctx.dragPickupOpacity = args.dragPickupOpacity;
  if (args.onHoverSquare) ctx.onHoverSquare = args.onHoverSquare;
  return ctx;
}

export function useBoardGestures(args: BoardGesturesArgs) {
  // Tracks last square index dispatched to JS; eliminates per-tick runOnJS
  // when the pointer stays inside the same cell (~60Hz → ≤8/sec).
  const lastHoverIndex = useSharedValue<number>(HOVER_NONE);
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
    onHoverSquare,
    onDrop,
  } = args;

  return useMemo(() => {
    const tap = buildTapGesture({
      interactive,
      size,
      orientation,
      position,
      turn,
      selected,
      legalTargets,
      setSelected,
      onDrop,
    });
    const pan = buildPanGesture(
      buildPanContext(args, lastHoverIndex),
      interactive
    );
    return Gesture.Race(pan, tap);
    // `args` is captured for pan ctx; deps are spelled out explicitly so the
    // memo only recomputes when an actually-relevant value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    onHoverSquare,
    lastHoverIndex,
  ]);
}
