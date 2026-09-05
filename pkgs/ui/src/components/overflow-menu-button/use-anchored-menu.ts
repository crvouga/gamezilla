/**
 * `useAnchoredMenu` -- state machine for an anchored popover menu.
 *
 * Pairs a `Box` ref (the trigger) with open/close + measurement state
 * suitable for {@link FloatingMenu}. Lives at the package level so multiple
 * chrome surfaces (top bars, rail footers, custom menus) can share the same
 * trigger plumbing without duplicating `measureInWindow` calls.
 */

import { useCallback, useRef, useState } from 'react';
import type { LayoutRectangle } from 'react-native';

import type { Box } from '../box';

export type AnchoredMenuController = {
  open: boolean;
  anchor: LayoutRectangle | null;
  triggerRef: React.RefObject<React.ElementRef<typeof Box> | null>;
  openMenu: () => void;
  close: () => void;
};

export function useAnchoredMenu(): AnchoredMenuController {
  const triggerRef = useRef<React.ElementRef<typeof Box> | null>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setAnchor(null);
  }, []);

  const openMenu = useCallback(() => {
    const node = triggerRef.current;
    if (node == null) {
      // Ref not attached yet (common under heavy RNTL load) — still open so
      // menu rows with testIDs become findable; position is best-effort.
      setAnchor({ x: 0, y: 0, width: 0, height: 0 });
      setOpen(true);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, []);

  return { open, anchor, triggerRef, openMenu, close };
}
