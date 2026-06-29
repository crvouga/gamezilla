import { useMemo } from 'react';
import { Platform } from 'react-native';
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
  /** Native: snap pickup scale/opacity instantly (withTiming crashes some iOS Skia paths). */
  snapPickup?: boolean;
  setSelected: (sq: Square | null) => void;
  onPanPickupStart: (from: Square) => void;
  onDragStart: (from: Square) => void;
  onDragEnd: () => void;
  onHoverSquare?: (sq: Square | null) => void;
  onDrop: (fromSq: Square, toSq: Square) => void;
  /**
   * Single-hop finger-up commit. Replaces the previous 3-4
   * `runOnJS(...)` calls inside `onPanEnd` with one bridge crossing —
   * see {@link useChessBoardHandlers.commitDrop} for the ordering
   * rationale (drop applies before dragFrom clears so the source square
   * never flashes back the lifted piece for a frame).
   */
  commitDrop: (p: { startSq: Square | null; toSq: Square | null }) => void;
};

const PICKUP_IN_MS = 120;
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

function snapPickupTo(
  ctx: {
    dragPickupScale?: SharedValue<number>;
    dragPickupOpacity?: SharedValue<number>;
  },
  toScale: number,
  toOpacity: number
): void {
  'worklet';
  if (ctx.dragPickupScale) ctx.dragPickupScale.value = toScale;
  if (ctx.dragPickupOpacity) ctx.dragPickupOpacity.value = toOpacity;
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
  snapPickup: boolean;
  lastHoverIndex: SharedValue<number>;
  setSelected: (sq: Square | null) => void;
  onPanPickupStart: (from: Square) => void;
  onDragStart: (from: Square) => void;
  onDragEnd: () => void;
  onHoverSquare?: (sq: Square | null) => void;
  onDrop: (fromSq: Square, toSq: Square) => void;
  commitDrop: (p: { startSq: Square | null; toSq: Square | null }) => void;
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

  runOnJS(ctx.onPanPickupStart)(sq);
  ctx.dragX.value = e.x;
  ctx.dragY.value = e.y;
  ctx.isDragging.value = true;
  if (ctx.snapPickup) {
    snapPickupTo(ctx, PICKUP_SCALE, PICKUP_OPACITY);
  } else {
    pickupTo(ctx, PICKUP_SCALE, PICKUP_OPACITY, PICKUP_IN_MS);
  }
  emitHover(ctx, idx, sq);
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

function snapPickupReset(ctx: PanContext): void {
  'worklet';
  // The overlay is hidden via `isDragging = false` (see
  // `ChessBoardDragPieceSkia`'s `useDerivedValue`), so the previous
  // `withTiming(... PICKUP_OUT_MS)` ramp on `dragPickupScale` /
  // `dragPickupOpacity` was never visible — but every drop still paid
  // for two reanimated timing worklets. Snap the values back instantly.
  if (ctx.dragPickupScale) ctx.dragPickupScale.value = 1;
  if (ctx.dragPickupOpacity) ctx.dragPickupOpacity.value = 1;
}

function onPanEnd(
  ctx: PanContext,
  e: { x: number; y: number; translationX: number; translationY: number }
): void {
  'worklet';
  if (!ctx.isDragging.value) return;
  snapPickupReset(ctx);
  ctx.isDragging.value = false;
  ctx.lastHoverIndex.value = HOVER_NONE;

  const toSq = xyToSquare(e.x, e.y, ctx.size, ctx.orientation);
  const startX = e.x - e.translationX;
  const startY = e.y - e.translationY;
  const startSq = xyToSquare(startX, startY, ctx.size, ctx.orientation);

  // Single bridge crossing. `commitDrop` handles drop + interaction-state
  // teardown in one React-batched commit.
  runOnJS(ctx.commitDrop)({ startSq, toSq });
}

function onPanFinalize(ctx: PanContext): void {
  'worklet';
  if (!ctx.isDragging.value) return;
  snapPickupReset(ctx);
  ctx.isDragging.value = false;
  ctx.lastHoverIndex.value = HOVER_NONE;
  // No drop on cancel; the same commit path still tears down dragFrom /
  // hover / selected with the null/null sentinel.
  runOnJS(ctx.commitDrop)({ startSq: null, toSq: null });
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
    snapPickup: args.snapPickup ?? false,
    setSelected: args.setSelected,
    onPanPickupStart: args.onPanPickupStart,
    onDragStart: args.onDragStart,
    onDragEnd: args.onDragEnd,
    onDrop: args.onDrop,
    commitDrop: args.commitDrop,
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
    snapPickup = Platform.OS !== 'web',
    setSelected,
    onPanPickupStart,
    onDragStart,
    onDragEnd,
    onHoverSquare,
    onDrop,
    commitDrop,
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
    commitDrop,
    onDragEnd,
    onPanPickupStart,
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
    snapPickup,
    onHoverSquare,
    lastHoverIndex,
  ]);
}
