/** @jsxImportSource solid-js */

import { t } from '@lingui/core/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { createScreenSlot } from '../screen-slot';
import styles from './toast-stack.module.css';

export type ToastStackProps = {
  /**
   * The alerts showing now (`Notice`s, a compact `ErrorState`): what comes
   * and goes (the connection, the host away, a refused change). Empty
   * draws nothing.
   */
  children?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `ToastStack` -- the one place a temporary alert shows: a stack of
 * floating cards over the top of the screen, outside the page's flow, so
 * the page (a game board above all) never moves or resizes when an alert
 * comes or goes. Each alert keeps its own words, tone and way forward (a
 * `Notice`'s action, an `ErrorState`'s retry). An outcome that ends a
 * phase (a game over) is a dialog instead; a control's own result stays
 * on the control (`useMutationButton`).
 *
 * @example
 * ```tsx
 * <ToastStack>
 *   <Show when={hostAway()}><Notice tone="info">…</Notice></Show>
 * </ToastStack>
 * ```
 */
export function ToastStack(props: ToastStackProps): JSX.Element {
  const alerts = createScreenSlot(() => props.children);
  return (
    <Show when={alerts.present()}>
      <Portal>
        <div
          class={styles['stack']}
          role="region"
          aria-label={t`Alerts`}
          aria-live="polite"
          {...dataAttrs({ component: 'ToastStack', ...props.dataSet })}
        >
          {alerts.content()}
        </div>
      </Portal>
    </Show>
  );
}
