/**
 * `useAnchoredMenu` -- state machine for an anchored popover menu.
 *
 * Pairs a trigger element ref with open/close state suitable for a floating
 * menu. The anchor is the trigger element itself: the menu (a later
 * component) positions itself against it with CSS or its own measurement.
 */

import { type Accessor, createSignal } from 'solid-js';

export type AnchoredMenuController = {
  open: Accessor<boolean>;
  /** Trigger element, once mounted. */
  anchor: Accessor<HTMLElement | null>;
  /** Attach to the trigger wrapper (`ref={menu.setTrigger}`). */
  setTrigger: (el: HTMLElement) => void;
  openMenu: () => void;
  close: () => void;
  toggle: () => void;
};

export function useAnchoredMenu(): AnchoredMenuController {
  const [open, setOpen] = createSignal(false);
  const [anchor, setAnchor] = createSignal<HTMLElement | null>(null);
  const openMenu = (): void => {
    setOpen(true);
  };
  const close = (): void => {
    setOpen(false);
  };
  return {
    open,
    anchor,
    setTrigger: (el) => setAnchor(el),
    openMenu,
    close,
    toggle: () => setOpen((v) => !v),
  };
}
