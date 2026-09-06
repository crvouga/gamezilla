/** @jsxImportSource solid-js */
/**
 * DOM focus trap. Traps Tab within the subtree, moves focus in on activate,
 * restores it on deactivate, and dismisses via Escape (innermost trap wins)
 * when `onEscape` is set. The host exposes dialog semantics
 * (`role="dialog"`, `aria-modal`).
 */

import { createEffect, type JSX, onCleanup, untrack } from 'solid-js';
import type { SxInput } from '../../theme';
import { Box } from '../box';
import { pushEscapeDismissHandler } from './escape-dismiss-stack';
import { collectTabbable, nextTabStop } from './focus-trap-logic';

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
   * - `sheet`: in-flow stretch for bottom sheets.
   */
  layout?: 'cover' | 'sheet' | undefined;
  /** Extra `sx` on the host (merged after layout defaults). */
  sx?: SxInput | undefined;
  children?: JSX.Element | undefined;
};

const COVER_HOST_SX = { absoluteFill: true, flex: 1 } as const;
const SHEET_HOST_SX = { width: '100%', flexGrow: 1 } as const;

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

export function FocusTrap(props: FocusTrapProps): JSX.Element {
  let hostEl: HTMLElement | undefined;
  const host = (): HTMLElement => {
    if (hostEl === undefined) throw new Error('FocusTrap host not mounted');
    return hostEl;
  };
  useTrapLifecycle(props, host);
  return (
    <Box
      ref={(el) => {
        hostEl = el;
      }}
      role="dialog"
      aria-modal="true"
      aria-label={props.label}
      aria-labelledby={props.labelledBy}
      tabIndex={-1}
      sx={[props.layout === 'sheet' ? SHEET_HOST_SX : COVER_HOST_SX, props.sx]}
      dataSet={{ component: 'FocusTrap' }}
    >
      {props.children}
    </Box>
  );
}
