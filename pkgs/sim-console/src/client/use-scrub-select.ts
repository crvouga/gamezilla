import { createEffect, createSignal, onCleanup } from 'solid-js';

import { frameIndexFromX } from './frame-scrubber';
import {
  capturePointer,
  lockBodyUserSelect,
  readTrackLeft,
  releasePointer,
  restoreBodyUserSelect,
} from './scrub-pointer-dom';

export type ScrubPointerHandlers = {
  readonly scrubbing: boolean;
  readonly setWidth: (width: number) => void;
  readonly onPointerDown: (e: PointerEvent) => void;
  readonly onPointerMove: (e: PointerEvent) => void;
  readonly onPointerUp: (e: PointerEvent) => void;
  readonly onPointerCancel: (e: PointerEvent) => void;
  readonly onLostPointerCapture: (e: PointerEvent) => void;
};

type ScrubRefs = {
  widthRef: { current: number };
  trackLeftRef: { current: number };
  pendingIndexRef: { current: number | null };
  rafRef: { current: number | null };
  pointerIdRef: { current: number | null };
  bodyUserSelectRef: { current: string | null };
};

function buildScrubHandlers(args: {
  refs: ScrubRefs;
  frameCount: () => number;
  onSelect: (index: number) => void;
  setScrubbing: (v: boolean) => void;
  cancelPendingRaf: () => void;
  flushPending: () => void;
  endScrub: (target: unknown, pointerId: number | null) => void;
}): Omit<ScrubPointerHandlers, 'scrubbing' | 'setWidth'> {
  const { refs, onSelect, setScrubbing } = args;
  const indexFromClientX = (clientX: number) =>
    frameIndexFromX({
      x: clientX - refs.trackLeftRef.current,
      width: refs.widthRef.current,
      frameCount: args.frameCount(),
    });

  return {
    onPointerDown: (e) => {
      e.preventDefault();
      capturePointer(e.currentTarget, e.pointerId);
      const left = readTrackLeft(e.currentTarget);
      if (left != null) refs.trackLeftRef.current = left;
      refs.pointerIdRef.current = e.pointerId;
      setScrubbing(true);
      lockBodyUserSelect(refs.bodyUserSelectRef);
      args.cancelPendingRaf();
      refs.pendingIndexRef.current = null;
      onSelect(indexFromClientX(e.clientX));
    },
    onPointerMove: (e) => {
      if (refs.pointerIdRef.current !== e.pointerId) return;
      const left = readTrackLeft(e.currentTarget);
      if (left != null) refs.trackLeftRef.current = left;
      refs.pendingIndexRef.current = indexFromClientX(e.clientX);
      if (refs.rafRef.current != null) return;
      refs.rafRef.current = requestAnimationFrame(args.flushPending);
    },
    onPointerUp: (e) => {
      if (refs.pointerIdRef.current !== e.pointerId) return;
      args.endScrub(e.currentTarget, e.pointerId);
    },
    onPointerCancel: (e) => {
      if (
        refs.pointerIdRef.current != null &&
        refs.pointerIdRef.current !== e.pointerId
      ) {
        return;
      }
      args.endScrub(e.currentTarget, e.pointerId);
    },
    onLostPointerCapture: () => {
      if (refs.pointerIdRef.current == null) return;
      args.endScrub(null, refs.pointerIdRef.current);
    },
  };
}

/** Pointer-capture scrubbing with rAF-coalesced moves. */
export function useScrubSelect(
  frameCount: () => number,
  onSelect: (index: number) => void
): ScrubPointerHandlers {
  const widthRef = { current: 0 };
  const trackLeftRef = { current: 0 };
  const pendingIndexRef: { current: number | null } = { current: null };
  const rafRef: { current: number | null } = { current: null };
  const pointerIdRef: { current: number | null } = { current: null };
  const bodyUserSelectRef: { current: string | null } = { current: null };
  const [scrubbing, setScrubbing] = createSignal(false);
  const refs: ScrubRefs = {
    widthRef,
    trackLeftRef,
    pendingIndexRef,
    rafRef,
    pointerIdRef,
    bodyUserSelectRef,
  };

  const flushPending = () => {
    rafRef.current = null;
    const index = pendingIndexRef.current;
    pendingIndexRef.current = null;
    if (index != null) onSelect(index);
  };

  const cancelPendingRaf = () => {
    if (rafRef.current == null) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const endScrub = (currentTarget: unknown, pointerId: number | null) => {
    cancelPendingRaf();
    flushPending();
    pointerIdRef.current = null;
    setScrubbing(false);
    restoreBodyUserSelect(bodyUserSelectRef);
    if (pointerId != null) releasePointer(currentTarget, pointerId);
  };

  createEffect(() => {
    onCleanup(() => {
      cancelPendingRaf();
      restoreBodyUserSelect(bodyUserSelectRef);
    });
  });

  const handlers = buildScrubHandlers({
    refs,
    frameCount,
    onSelect,
    setScrubbing,
    cancelPendingRaf,
    flushPending,
    endScrub,
  });

  return {
    get scrubbing() {
      return scrubbing();
    },
    setWidth: (width) => {
      widthRef.current = width;
    },
    ...handlers,
  };
}
