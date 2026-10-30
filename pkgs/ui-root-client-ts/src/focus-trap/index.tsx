/** @jsxImportSource solid-js */

import { pushEscapeDismissHandler } from '@pkgs/ui-root-shared-ts/escape-dismiss-stack';
import {
  collectTabbable,
  nextTabStop,
} from '@pkgs/ui-root-shared-ts/focus-trap-logic';
import { createEffect, type JSX, onCleanup, untrack } from 'solid-js';

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
  if (first !== undefined) first.focus();
  else host.focus();
}

function useTrapLifecycle(props: FocusTrapProps, host: () => HTMLElement) {
  createEffect(() => {
    if (!props.active) return;
    const el = host();
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (untrack(() => props.autoFocus ?? true)) focusInto(el);

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
    onCleanup(() => {
      el.removeEventListener('keydown', onKeyDown);
      if (untrack(() => props.returnFocus ?? true) && previous !== null) {
        previous.focus();
      }
    });
  });

  createEffect(() => {
    const onEscape = props.onEscape;
    if (!props.active || onEscape === undefined) return;
    onCleanup(pushEscapeDismissHandler(onEscape));
  });
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
    <div
      class={`box ${layoutClass()}`}
      data-component="FocusTrap"
      ref={(el) => {
        hostEl = el;
      }}
      role="dialog"
      aria-modal="true"
      aria-label={props.label}
      aria-labelledby={props.labelledBy}
      tabIndex={-1}
    >
      {props.children}
    </div>
  );
}
