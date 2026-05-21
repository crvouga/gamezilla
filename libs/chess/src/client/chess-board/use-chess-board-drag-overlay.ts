import { useOverlayPortalSlot } from '@pkgs/ui';
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LayoutChangeEvent, View } from 'react-native';

export type BoardOrigin = { x: number; y: number };

export type UseChessBoardDragOverlayResult = {
  /** Attach to the board's outer (positioned) View — drives `measureInWindow`. */
  containerRef: (node: View | null) => void;
  /** Pass to the same View's `onLayout`. */
  onContainerLayout: (e: LayoutChangeEvent) => void;
  /** Latest screen-relative origin of the board. */
  origin: BoardOrigin;
  /** Render the overlay node into the app overlay portal. Pass `null` to clear. */
  setOverlayNode: (node: ReactNode | null) => void;
};

/**
 * Bridges the in-board drag visuals to {@link OverlayPortalProvider}: tracks
 * the board's screen origin via `View.measureInWindow`, and registers an
 * arbitrary React node into the portal under a stable id. Callers translate
 * board-local pointer coords into screen coords via `origin`.
 */
export function useChessBoardDragOverlay(
  enabled: boolean
): UseChessBoardDragOverlayResult {
  const rawId = useId();
  const portalId = useMemo(
    () => `chess-drag-${rawId.replace(/:/g, '')}`,
    [rawId]
  );

  const viewRef = useRef<View | null>(null);
  const [origin, setOrigin] = useState<BoardOrigin>({ x: 0, y: 0 });
  const [node, setNode] = useState<ReactNode | null>(null);

  const measure = useCallback(() => {
    const v = viewRef.current;
    if (v === null) return;
    v.measureInWindow((x, y) => {
      setOrigin((prev) => {
        if (Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5) {
          return prev;
        }
        return { x, y };
      });
    });
  }, []);

  const containerRef = useCallback(
    (n: View | null) => {
      viewRef.current = n;
      if (n !== null) measure();
    },
    [measure]
  );

  const onContainerLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      measure();
    },
    [measure]
  );

  useOverlayPortalSlot(portalId, node, enabled && node !== null);

  return {
    containerRef,
    onContainerLayout,
    origin,
    setOverlayNode: setNode,
  };
}
