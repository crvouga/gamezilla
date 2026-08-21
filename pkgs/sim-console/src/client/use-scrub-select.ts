import { useCallback, useEffect, useRef, useState } from 'react';

import { frameIndexFromX } from './frame-scrubber';
import {
  capturePointer,
  lockBodyUserSelect,
  readTrackLeft,
  releasePointer,
  restoreBodyUserSelect,
} from './scrub-pointer-dom';

type PointerDownEvent = {
  nativeEvent: { clientX: number; pointerId: number };
  currentTarget: unknown;
  preventDefault: () => void;
};

type PointerMoveEvent = {
  nativeEvent: { clientX: number; pointerId: number };
  currentTarget: unknown;
};

type PointerUpEvent = {
  nativeEvent: { pointerId: number };
  currentTarget: unknown;
};

export type ScrubPointerHandlers = {
  readonly scrubbing: boolean;
  readonly setWidth: (width: number) => void;
  readonly onPointerDown: (e: PointerDownEvent) => void;
  readonly onPointerMove: (e: PointerMoveEvent) => void;
  readonly onPointerUp: (e: PointerUpEvent) => void;
  readonly onPointerCancel: (e: PointerUpEvent) => void;
  readonly onLostPointerCapture: () => void;
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
  frameCount: number;
  onSelect: (index: number) => void;
  setScrubbing: (v: boolean) => void;
  cancelPendingRaf: () => void;
  flushPending: () => void;
  endScrub: (target: unknown, pointerId: number | null) => void;
}): Omit<ScrubPointerHandlers, 'scrubbing' | 'setWidth'> {
  const { refs, frameCount, onSelect, setScrubbing } = args;
  const indexFromClientX = (clientX: number) =>
    frameIndexFromX({
      x: clientX - refs.trackLeftRef.current,
      width: refs.widthRef.current,
      frameCount,
    });

  return {
    onPointerDown: (e) => {
      e.preventDefault();
      capturePointer(e.currentTarget, e.nativeEvent.pointerId);
      const left = readTrackLeft(e.currentTarget);
      if (left != null) refs.trackLeftRef.current = left;
      refs.pointerIdRef.current = e.nativeEvent.pointerId;
      setScrubbing(true);
      lockBodyUserSelect(refs.bodyUserSelectRef);
      args.cancelPendingRaf();
      refs.pendingIndexRef.current = null;
      onSelect(indexFromClientX(e.nativeEvent.clientX));
    },
    onPointerMove: (e) => {
      if (refs.pointerIdRef.current !== e.nativeEvent.pointerId) return;
      const left = readTrackLeft(e.currentTarget);
      if (left != null) refs.trackLeftRef.current = left;
      refs.pendingIndexRef.current = indexFromClientX(e.nativeEvent.clientX);
      if (refs.rafRef.current != null) return;
      refs.rafRef.current = requestAnimationFrame(args.flushPending);
    },
    onPointerUp: (e) => {
      if (refs.pointerIdRef.current !== e.nativeEvent.pointerId) return;
      args.endScrub(e.currentTarget, e.nativeEvent.pointerId);
    },
    onPointerCancel: (e) => {
      if (
        refs.pointerIdRef.current != null &&
        refs.pointerIdRef.current !== e.nativeEvent.pointerId
      ) {
        return;
      }
      args.endScrub(e.currentTarget, e.nativeEvent.pointerId);
    },
    onLostPointerCapture: () => {
      if (refs.pointerIdRef.current == null) return;
      args.endScrub(null, refs.pointerIdRef.current);
    },
  };
}

/** Pointer-capture scrubbing with rAF-coalesced moves. */
export function useScrubSelect(
  frameCount: number,
  onSelect: (index: number) => void
): ScrubPointerHandlers {
  const widthRef = useRef(0);
  const trackLeftRef = useRef(0);
  const pendingIndexRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const bodyUserSelectRef = useRef<string | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const refs: ScrubRefs = {
    widthRef,
    trackLeftRef,
    pendingIndexRef,
    rafRef,
    pointerIdRef,
    bodyUserSelectRef,
  };

  const flushPending = useCallback(() => {
    rafRef.current = null;
    const index = pendingIndexRef.current;
    pendingIndexRef.current = null;
    if (index != null) onSelect(index);
  }, [onSelect]);

  const cancelPendingRaf = useCallback(() => {
    if (rafRef.current == null) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const endScrub = useCallback(
    (currentTarget: unknown, pointerId: number | null) => {
      cancelPendingRaf();
      flushPending();
      pointerIdRef.current = null;
      setScrubbing(false);
      restoreBodyUserSelect(bodyUserSelectRef);
      if (pointerId != null) releasePointer(currentTarget, pointerId);
    },
    [cancelPendingRaf, flushPending]
  );

  useEffect(
    () => () => {
      cancelPendingRaf();
      restoreBodyUserSelect(bodyUserSelectRef);
    },
    [cancelPendingRaf]
  );

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
    scrubbing,
    setWidth: (width) => {
      widthRef.current = width;
    },
    ...handlers,
  };
}
