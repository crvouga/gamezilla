/** @jsxImportSource @solidjs/web */

import { pushEscapeDismissHandler } from '@pkgs/ui-root-shared-ts/escape-dismiss-stack';
import {
  collectTabbable,
  nextTabStop,
} from '@pkgs/ui-root-shared-ts/focus-trap-logic';
import type { JSX } from '@solidjs/web';
import { Dialog, DialogContent } from '@ui-sdk/solid/dialog';
import {
  createEffect,
  createMemo,
  createRenderEffect,
  flush,
  untrack,
} from 'solid-js';
import { moveFocus } from '../move-focus';

export type FocusTrapProps = {
  /** When true, trap Tab focus inside the subtree. */
  active: boolean;
  /** Move focus into the trap on activate. Default `true`. */
  autoFocus?: boolean | undefined;
  /** Restore focus to the prior element on deactivate. Default `true`. */
  returnFocus?: boolean | undefined;
  /** Escape while this trap is the innermost active overlay. */
  onEscape?: (() => void) | undefined;
  /** Accessible name for the dialog host. */
  label?: string | undefined;
  /** Id of the element naming the dialog (`aria-labelledby`, wins over `label`). */
  labelledBy?: string | undefined;
  /**
   * - `cover` (default): absolute-fill for full-screen modal backdrops.
   * - `sheet`: in-flow stretch for bottom sheets; it may shrink and clips
   *   its content so the sheet's own scroller engages.
   */
  layout?: 'cover' | 'sheet' | undefined;
  children?: JSX.Element | undefined;
};

const COVER_HOST_CLASS = 'absolute inset-0 flex-1';
const SHEET_HOST_CLASS = 'w-full grow shrink min-h-0 overflow-hidden';

function focusInto(host: HTMLElement): void {
  const first = collectTabbable(host)[0];
  moveFocus(first ?? host);
}

function useTrapLifecycle(props: FocusTrapProps, host: () => HTMLElement) {
  const active = createMemo(() => props.active);
  // Whether to hand focus back is decided when the trap lets go, from the
  // value the trap holds then.
  let returnFocus = true;
  createRenderEffect(
    () => props.returnFocus ?? true,
    (value) => {
      returnFocus = value;
    }
  );
  createEffect(
    // Activating starts the trap; `autoFocus` is read as it stands then.
    () => (active() ? untrack(() => props.autoFocus ?? true) : undefined),
    (autoFocus) => {
      if (autoFocus === undefined) return undefined;
      const el = host();
      const previous =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (autoFocus) focusInto(el);

      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key !== 'Tab') return;
        const target = nextTabStop(
          collectTabbable(el),
          document.activeElement,
          ev.shiftKey
        );
        if (target === null) return;
        ev.preventDefault();
        target.focus();
      };
      el.addEventListener('keydown', onKeyDown);
      return () => {
        el.removeEventListener('keydown', onKeyDown);
        if (returnFocus) moveFocus(previous);
      };
    }
  );

  createEffect(
    () => (active() ? props.onEscape : undefined),
    (onEscape) =>
      onEscape === undefined ? undefined : pushEscapeDismissHandler(onEscape)
  );
}

/**
 * DOM focus trap. Traps Tab within the subtree, moves focus in on activate,
 * restores it on deactivate, and dismisses via Escape (innermost trap wins)
 * when `onEscape` is set. The host exposes dialog semantics
 * (`role="dialog"`, `aria-modal`).
 */
export function FocusTrap(props: FocusTrapProps): JSX.Element {
  let hostEl: HTMLElement | undefined;
  const host = (): HTMLElement => {
    if (hostEl === undefined) throw new Error('FocusTrap host not mounted');
    return hostEl;
  };
  useTrapLifecycle(props, host);
  const layoutClass = () =>
    props.layout === 'sheet' ? SHEET_HOST_CLASS : COVER_HOST_CLASS;
  return (
    <Dialog
      defaultOpen
      modal={false}
      dismissible={false}
      onOpenChange={(open, details) => {
        if (open) return;
        if (!props.active || props.onEscape === undefined) {
          details.cancel();
          return;
        }
        props.onEscape();
        flush();
        if (hostEl?.isConnected) details.cancel();
      }}
    >
    <DialogContent
      inline
      initialFocus="none"
      finalFocus="none"
      class={`box ${layoutClass()}`}
      data-component="FocusTrap"
      ref={(el) => {
        hostEl = el;
      }}
      aria-modal="true"
      aria-label={props.label}
      aria-labelledby={props.labelledBy}
      tabindex={-1}
    >
      {props.children}
    </DialogContent>
    </Dialog>
  );
}
