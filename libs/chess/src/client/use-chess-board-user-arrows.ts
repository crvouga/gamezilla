import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, type View } from 'react-native';
import { xyToSquare } from './chess-board-geometry';
import type {
  BoardArrow,
  BoardOrientation,
  BoardTheme,
  Square,
} from './chess-board-types';

/**
 * Resolves the lichess-style modifier-keyed arrow color for a web pointer
 * event. `default` (no modifiers) → primary, shift → danger, alt → secondary,
 * ctrl/meta → alt.
 */
function arrowColorForWebEvent(
  e: {
    shiftKey?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
  },
  theme: BoardTheme
): string {
  if (e.shiftKey === true) return theme.arrows.danger;
  if (e.altKey === true) return theme.arrows.secondary;
  if (e.ctrlKey === true || e.metaKey === true) return theme.arrows.alt;
  return theme.arrows.primary;
}

function dedupeArrowKey(a: BoardArrow): string {
  return `${a.from}-${a.to}-${a.color ?? ''}-${a.dashed === true ? 'd' : ''}`;
}

/**
 * Toggles `incoming` against `current`: if an identical arrow is present it
 * removes it (lichess "draw same arrow again to erase"); otherwise appends.
 */
function applyArrowToggle(
  current: readonly BoardArrow[],
  incoming: BoardArrow
): readonly BoardArrow[] {
  const key = dedupeArrowKey(incoming);
  const idx = current.findIndex((a) => dedupeArrowKey(a) === key);
  if (idx >= 0) {
    const next = [...current];
    next.splice(idx, 1);
    return next;
  }
  return [...current, incoming];
}

type WebPointerEventLike = {
  button?: number;
  offsetX?: number;
  offsetY?: number;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  preventDefault?: () => void;
};

type DragState = {
  from: Square;
  color: string;
};

type WebHandlersArgs = {
  enabled: boolean;
  size: number;
  orientation: BoardOrientation;
  theme: BoardTheme;
  arrowsRef: React.MutableRefObject<readonly BoardArrow[]>;
  commit: (next: readonly BoardArrow[]) => void;
};

function useWebArrowHandlers(args: WebHandlersArgs): {
  onPointerDown: (e: WebPointerEventLike) => void;
  onPointerUp: (e: WebPointerEventLike) => void;
} {
  const { enabled, size, orientation, theme, arrowsRef, commit } = args;
  const dragRef = useRef<DragState | null>(null);

  const onPointerDown = useCallback(
    (e: WebPointerEventLike) => {
      if (!enabled || Platform.OS !== 'web' || e.button !== 2) return;
      e.preventDefault?.();
      const x = e.offsetX ?? 0;
      const y = e.offsetY ?? 0;
      const sq = xyToSquare(x, y, size, orientation);
      if (sq === null) return;
      dragRef.current = {
        from: sq,
        color: arrowColorForWebEvent(e, theme),
      };
    },
    [enabled, orientation, size, theme]
  );

  const onPointerUp = useCallback(
    (e: WebPointerEventLike) => {
      if (!enabled || Platform.OS !== 'web' || e.button !== 2) return;
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag === null) return;
      const x = e.offsetX ?? 0;
      const y = e.offsetY ?? 0;
      const sq = xyToSquare(x, y, size, orientation);
      if (sq === null || sq === drag.from) return;
      const incoming: BoardArrow = {
        from: drag.from,
        to: sq,
        color: drag.color,
      };
      commit(applyArrowToggle(arrowsRef.current, incoming));
    },
    [arrowsRef, commit, enabled, orientation, size]
  );

  return { onPointerDown, onPointerUp };
}

function useSuppressWebContextMenu(
  enabled: boolean,
  containerNodeRef: React.MutableRefObject<View | null>
): void {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    const node = containerNodeRef.current as unknown as HTMLElement | null;
    if (node === null) return;
    const onContextMenu = (e: Event): void => {
      e.preventDefault();
    };
    node.addEventListener('contextmenu', onContextMenu);
    return () => {
      node.removeEventListener('contextmenu', onContextMenu);
    };
  }, [containerNodeRef, enabled]);
}

export type UseUserArrowsArgs = {
  size: number;
  orientation: BoardOrientation;
  theme: BoardTheme;
  enabled: boolean;
  onChange?: (arrows: readonly BoardArrow[]) => void;
};

export type UseUserArrowsResult = {
  arrows: readonly BoardArrow[];
  /** Attach to the wrapping View; only meaningful on web. */
  webEventHandlers: Record<string, unknown>;
  setArrows: (next: readonly BoardArrow[]) => void;
  clearArrows: () => void;
  /** Web-only: ref-callback to attach DOM listeners (suppresses contextmenu). */
  containerRef: (n: View | null) => void;
};

/**
 * User-drawn arrows. Web: right-click + drag from `from` to `to`. Native is
 * currently a no-op (could be wired to LongPress + Pan later); the hook still
 * returns the persisted arrow list so consumers can mix programmatic edits in.
 */
export function useUserArrows(args: UseUserArrowsArgs): UseUserArrowsResult {
  const { size, orientation, theme, enabled, onChange } = args;
  const [arrows, setArrowsState] = useState<readonly BoardArrow[]>([]);
  const arrowsRef = useRef<readonly BoardArrow[]>(arrows);
  arrowsRef.current = arrows;

  const containerNodeRef = useRef<View | null>(null);

  const commit = useCallback(
    (next: readonly BoardArrow[]) => {
      setArrowsState(next);
      onChange?.(next);
    },
    [onChange]
  );

  const setArrows = useCallback(
    (next: readonly BoardArrow[]) => {
      commit(next);
    },
    [commit]
  );

  const clearArrows = useCallback(() => {
    if (arrowsRef.current.length === 0) return;
    commit([]);
  }, [commit]);

  const webHandlers = useWebArrowHandlers({
    enabled,
    size,
    orientation,
    theme,
    arrowsRef,
    commit,
  });

  useSuppressWebContextMenu(enabled, containerNodeRef);

  const containerRef = useCallback((n: View | null) => {
    containerNodeRef.current = n;
  }, []);

  const webEventHandlers = useMemo(() => {
    if (!enabled || Platform.OS !== 'web') return {};
    return {
      onPointerDown: webHandlers.onPointerDown,
      onPointerUp: webHandlers.onPointerUp,
    } as Record<string, unknown>;
  }, [enabled, webHandlers.onPointerDown, webHandlers.onPointerUp]);

  return {
    arrows,
    webEventHandlers,
    setArrows,
    clearArrows,
    containerRef,
  };
}
