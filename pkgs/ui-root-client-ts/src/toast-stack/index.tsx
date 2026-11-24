/** @jsxImportSource solid-js */

import { t } from '@lingui/core/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  children,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  Show,
  useContext,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { CloseIconButton } from '../close-icon-button/index';
import styles from './toast-stack.module.css';

export type ToastStackProps = {
  /**
   * The alerts showing now (`Notice`s, a compact `ErrorState`): what comes
   * and goes (the connection, the host away, a refused change). Empty
   * draws nothing.
   */
  children?: JSX.Element | undefined;
  /**
   * Where the stack floats on a phone: `bottom` (default), above the
   * screen's own bottom chrome, clear of a page's title and its content's
   * head; `above-commands`, above a game's command bar; `above-actions`,
   * above a tab bar and a floating command (a lobby's New space) or a
   * lobby's docked commands; `top`, under the top bar. A wide window always
   * uses the page's bottom corner.
   */
  placement?: 'top' | 'bottom' | 'above-commands' | 'above-actions' | undefined;
  /**
   * The alerts last exactly as long as their cause (no connection, the host
   * offline) and are the page's only word on it: no close, so the reason
   * never disappears while it still holds.
   */
  persistent?: boolean | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/** The alerts' words, so a new or changed alert shows again once closed. */
function alertsKey(nodes: readonly unknown[]): string {
  return nodes
    .map((node) => (node instanceof Node ? (node.textContent ?? '') : ''))
    .join('\n');
}

/**
 * `ToastStack` -- the one place a temporary alert shows: floating cards
 * over the screen, outside the page's flow, so the page (a game board above
 * all) never moves or resizes when an alert comes or goes. Each alert keeps
 * its own words, tone and way forward (a `Notice`'s action, an
 * `ErrorState`'s retry); the stack's close puts the alerts away until one
 * changes. Above every dialog's scrim. An outcome that ends a phase (a game
 * over) is a dialog instead; a control's own result stays on the control.
 *
 * @example
 * ```tsx
 * <ToastStack>
 *   <Show when={hostAway()}><Notice tone="info">…</Notice></Show>
 * </ToastStack>
 * ```
 */
export function ToastStack(props: ToastStackProps): JSX.Element {
  // A stack inside another's alerts (a feature's own alerts passed on as a
  // session's notices) adds its alerts to that stack, never a second one.
  const nested = useContext(InStack);
  return (
    <Show when={!nested} fallback={props.children}>
      <InStack.Provider value={true}>
        <StackBody {...props} />
      </InStack.Provider>
    </Show>
  );
}

const InStack = createContext(false);

function StackBody(props: ToastStackProps): JSX.Element {
  const resolved = children(() => props.children);
  const nodes = createMemo(() =>
    resolved.toArray().filter((node) => node !== null && node !== undefined)
  );
  const key = createMemo(() => alertsKey(nodes()));
  const [dismissed, setDismissed] = createSignal<string | null>(null);
  createEffect(
    on(key, (now) => {
      if (now !== dismissed()) setDismissed(null);
    })
  );
  const shown = (): boolean => nodes().length > 0 && dismissed() === null;
  return (
    <Show when={shown()}>
      <Portal>
        <div
          class={styles['stack']}
          role="region"
          aria-label={t`Alerts`}
          aria-live="polite"
          data-placement={props.placement ?? 'bottom'}
          {...dataAttrs({ component: 'ToastStack', ...props.dataSet })}
        >
          <div class={styles['item']}>
            {nodes()}
            <Show when={props.persistent !== true}>
              <span class={styles['close']}>
                <CloseIconButton
                  onClick={() => setDismissed(key())}
                  dataSet={{ testid: 'toast-dismiss' }}
                />
              </span>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
