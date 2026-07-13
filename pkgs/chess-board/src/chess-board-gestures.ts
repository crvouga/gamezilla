import { useEffect, useMemo, useRef } from 'react';
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
import {
  HOVER_NONE,
  indexFromSquare,
  xyToSquare,
} from './chess-board-geometry';

export { HOVER_NONE };

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
  /** UI-thread hover square index (-1 = none). Never hops to JS during drag. */
  hoverSquareIndex: SharedValue<number>;
  dragPickupScale?: SharedValue<number>;
  dragPickupOpacity?: SharedValue<number>;
  /** Native: snap pickup scale/opacity instantly (withTiming crashes some iOS Skia paths). */
  snapPickup?: boolean;
  setSelected: (sq: Square | null) => void;
  onPanPickupStart: (from: Square) => void;
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
/** Kept modest so the ghost stays readable without huge overdraw. */
const PICKUP_SCALE = 1.25;
const PICKUP_OPACITY = 0.85;

function encodePositionCodes(position: Position): string {
  let out = '';
  for (let i = 0; i < 64; i++) {
    const p = position[i];
    if (!p) {
      out += '.';
      continue;
    }
    out += p.color === 'w' ? p.type.toUpperCase() : p.type;
  }
  return out;
}

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

type TapRefs = {
  interactive: boolean;
  size: number;
  orientation: BoardOrientation;
  positionRef: { current: Position };
  turnRef: { current: 'w' | 'b' };
  selectedRef: { current: Square | null };
  legalTargetsRef: { current: readonly Square[] };
  setSelected: (sq: Square | null) => void;
  onDrop: (fromSq: Square, toSq: Square) => void;
};

function buildTapGesture(refs: TapRefs) {
  const {
    interactive,
    size,
    orientation,
    positionRef,
    turnRef,
    selectedRef,
    legalTargetsRef,
    setSelected,
    onDrop,
  } = refs;
  return Gesture.Tap()
    .runOnJS(true)
    .enabled(interactive)
    .onEnd((e) => {
      const sq = xyToSquare(e.x, e.y, size, orientation);
      if (sq === null) return;
      const selected = selectedRef.current;
      const position = positionRef.current;
      const turn = turnRef.current;
      const legalTargets = legalTargetsRef.current;
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
  positionCodes: SharedValue<string>;
  turnIsWhite: SharedValue<number>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  dragPickupScale?: SharedValue<number>;
  dragPickupOpacity?: SharedValue<number>;
  snapPickup: boolean;
  hoverSquareIndex: SharedValue<number>;
  onPanPickupStart: (from: Square) => void;
  commitDrop: (p: { startSq: Square | null; toSq: Square | null }) => void;
};

function pieceMatchesTurn(code: string, turnIsWhite: number): boolean {
  'worklet';
  if (code === '.' || code.length === 0) return false;
  const isWhite = code === code.toUpperCase();
  return turnIsWhite === 1 ? isWhite : !isWhite;
}

function onPanBegin(ctx: PanContext, e: { x: number; y: number }): void {
  'worklet';
  const sq = xyToSquare(e.x, e.y, ctx.size, ctx.orientation);
  if (sq === null) return;
  const idx = indexFromSquare(sq);
  const code = ctx.positionCodes.value.charAt(idx);
  if (!pieceMatchesTurn(code, ctx.turnIsWhite.value)) return;

  runOnJS(ctx.onPanPickupStart)(sq);
  ctx.dragX.value = e.x;
  ctx.dragY.value = e.y;
  ctx.isDragging.value = true;
  ctx.hoverSquareIndex.value = idx;
  if (ctx.snapPickup) {
    snapPickupTo(ctx, PICKUP_SCALE, PICKUP_OPACITY);
  } else {
    pickupTo(ctx, PICKUP_SCALE, PICKUP_OPACITY, PICKUP_IN_MS);
  }
}

function onPanUpdate(ctx: PanContext, e: { x: number; y: number }): void {
  'worklet';
  if (!ctx.isDragging.value) return;
  ctx.dragX.value = e.x;
  ctx.dragY.value = e.y;
  const hoverSq = xyToSquare(e.x, e.y, ctx.size, ctx.orientation);
  const idx = hoverSq === null ? HOVER_NONE : indexFromSquare(hoverSq);
  if (ctx.hoverSquareIndex.value !== idx) {
    ctx.hoverSquareIndex.value = idx;
  }
}

function snapPickupReset(ctx: PanContext): void {
  'worklet';
  // The overlay is hidden via `isDragging = false`, so the previous
  // withTiming ramp was never visible — but every drop still paid for
  // two reanimated timing worklets. Snap the values back instantly.
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
  ctx.hoverSquareIndex.value = HOVER_NONE;

  const toSq = xyToSquare(e.x, e.y, ctx.size, ctx.orientation);
  const startX = e.x - e.translationX;
  const startY = e.y - e.translationY;
  const startSq = xyToSquare(startX, startY, ctx.size, ctx.orientation);

  runOnJS(ctx.commitDrop)({ startSq, toSq });
}

function onPanFinalize(ctx: PanContext): void {
  'worklet';
  if (!ctx.isDragging.value) return;
  snapPickupReset(ctx);
  ctx.isDragging.value = false;
  ctx.hoverSquareIndex.value = HOVER_NONE;
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

function buildPanContext(args: {
  size: number;
  orientation: BoardOrientation;
  positionCodes: SharedValue<string>;
  turnIsWhite: SharedValue<number>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  hoverSquareIndex: SharedValue<number>;
  dragPickupScale?: SharedValue<number>;
  dragPickupOpacity?: SharedValue<number>;
  snapPickup: boolean;
  onPanPickupStart: (from: Square) => void;
  commitDrop: (p: { startSq: Square | null; toSq: Square | null }) => void;
}): PanContext {
  const ctx: PanContext = {
    size: args.size,
    orientation: args.orientation,
    positionCodes: args.positionCodes,
    turnIsWhite: args.turnIsWhite,
    dragX: args.dragX,
    dragY: args.dragY,
    isDragging: args.isDragging,
    hoverSquareIndex: args.hoverSquareIndex,
    snapPickup: args.snapPickup,
    onPanPickupStart: args.onPanPickupStart,
    commitDrop: args.commitDrop,
  };
  if (args.dragPickupScale) ctx.dragPickupScale = args.dragPickupScale;
  if (args.dragPickupOpacity) ctx.dragPickupOpacity = args.dragPickupOpacity;
  return ctx;
}

type HitTestSync = {
  positionCodes: SharedValue<string>;
  turnIsWhite: SharedValue<number>;
  positionRef: { current: Position };
  turnRef: { current: 'w' | 'b' };
  selectedRef: { current: Square | null };
  legalTargetsRef: { current: readonly Square[] };
};

function useHitTestSync(
  position: Position,
  turn: 'w' | 'b',
  selected: Square | null,
  legalTargets: readonly Square[]
): HitTestSync {
  const positionCodes = useSharedValue(encodePositionCodes(position));
  const turnIsWhite = useSharedValue(turn === 'w' ? 1 : 0);
  useEffect(() => {
    positionCodes.value = encodePositionCodes(position);
  }, [position, positionCodes]);
  useEffect(() => {
    turnIsWhite.value = turn === 'w' ? 1 : 0;
  }, [turn, turnIsWhite]);
  const positionRef = useRef(position);
  positionRef.current = position;
  const turnRef = useRef(turn);
  turnRef.current = turn;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const legalTargetsRef = useRef(legalTargets);
  legalTargetsRef.current = legalTargets;
  return {
    positionCodes,
    turnIsWhite,
    positionRef,
    turnRef,
    selectedRef,
    legalTargetsRef,
  };
}

function buildBoardGestureRace(
  args: BoardGesturesArgs,
  hit: HitTestSync,
  snapPickup: boolean
) {
  const {
    size,
    orientation,
    interactive,
    dragX,
    dragY,
    isDragging,
    hoverSquareIndex,
    dragPickupScale,
    dragPickupOpacity,
    setSelected,
    onPanPickupStart,
    onDrop,
    commitDrop,
  } = args;
  const tap = buildTapGesture({
    interactive,
    size,
    orientation,
    positionRef: hit.positionRef,
    turnRef: hit.turnRef,
    selectedRef: hit.selectedRef,
    legalTargetsRef: hit.legalTargetsRef,
    setSelected,
    onDrop,
  });
  const pan = buildPanGesture(
    buildPanContext({
      size,
      orientation,
      positionCodes: hit.positionCodes,
      turnIsWhite: hit.turnIsWhite,
      dragX,
      dragY,
      isDragging,
      hoverSquareIndex,
      ...(dragPickupScale ? { dragPickupScale } : {}),
      ...(dragPickupOpacity ? { dragPickupOpacity } : {}),
      snapPickup,
      onPanPickupStart,
      commitDrop,
    }),
    interactive
  );
  return Gesture.Race(pan, tap);
}

export function useBoardGestures(args: BoardGesturesArgs) {
  const snapPickup = args.snapPickup ?? Platform.OS !== 'web';
  const hit = useHitTestSync(
    args.position,
    args.turn,
    args.selected,
    args.legalTargets
  );
  const {
    size,
    orientation,
    interactive,
    dragX,
    dragY,
    isDragging,
    hoverSquareIndex,
    dragPickupScale,
    dragPickupOpacity,
    setSelected,
    onPanPickupStart,
    onDrop,
    commitDrop,
  } = args;

  // Hit-test board state is read from SharedValues / refs; only structural
  // gesture identity deps belong here (rebuild on size/orientation/handlers).
  return useMemo(
    () => buildBoardGestureRace(args, hit, snapPickup),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hit.* are stable SharedValues/refs
    [
      interactive,
      onDrop,
      commitDrop,
      onPanPickupStart,
      orientation,
      setSelected,
      size,
      dragX,
      dragY,
      isDragging,
      hoverSquareIndex,
      dragPickupScale,
      dragPickupOpacity,
      snapPickup,
      hit.positionCodes,
      hit.turnIsWhite,
    ]
  );
}
