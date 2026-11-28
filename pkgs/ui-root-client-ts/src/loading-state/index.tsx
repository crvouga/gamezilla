/** @jsxImportSource @solidjs/web */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import type { SpinnerProps } from '../spinner/index';
import { quietActivityAtMount } from '../spinner-context/index';
import { Spinner } from '../spinner/index';
import type { StateBlockVariant } from '../state-block/index';
import { StateBlock } from '../state-block/index';

export type LoadingStateProps = {
  /** Optional caption rendered under the spinner. */
  caption?: JSX.Element | undefined;
  /** Layout density. Defaults to `'fill'`. */
  variant?: StateBlockVariant | undefined;
  /**
   * Spinner size. Defaults to {@link loadingStateSpinnerSize} of the
   * variant: `lg` for a whole-screen `fill` (the size boot paints, so the
   * indicator keeps one size from first paint to the screen's data), `md`
   * for an inline `compact` block.
   */
  size?: SpinnerProps['size'];
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * The spinner size a `LoadingState` of `variant` shows by default. A
 * whole-screen load stands alone in an empty viewport, where 24px reads as a
 * speck, so `fill` takes `lg`; the boot screens paint the same size.
 */
export function loadingStateSpinnerSize(
  variant: StateBlockVariant | undefined
): NonNullable<SpinnerProps['size']> {
  return (variant ?? 'fill') === 'fill' ? 'lg' : 'md';
}

/**
 * `LoadingState` -- canonical async loading block.
 *
 * The one block a screen, section or sheet shows while it waits: the
 * `Spinner` with an optional caption underneath. Two variants:
 *   - `'fill'`    (default) -- centered 40px Spinner inside `flex: 1`. Use for
 *                              full-screen Suspense fallbacks and screen-level
 *                              loads; boot paints the same size.
 *   - `'compact'` -- 24px Spinner, intrinsic height, padded. Use inline
 *                    inside a `Card` or section.
 *
 * @example
 * ```tsx
 * <Loading fallback={<LoadingState />}>{children}</Loading>
 * <LoadingState caption={t`Loading entity…`} />
 * <LoadingState variant="compact" caption={t`Waiting for metrics…`} />
 * ```
 */
export function LoadingState(props: LoadingStateProps): JSX.Element {
  const { t } = useLingui();
  if (quietActivityAtMount()) {
    return (
      <StateBlock variant={props.variant} dataSet={props.dataSet}>
        <p role="status" class="text textCaption text-center">{props.caption ?? t`Loading…`}</p>
      </StateBlock>
    );
  }
  return (
    <StateBlock
      variant={props.variant}
      dataSet={{ component: 'LoadingState', ...props.dataSet }}
    >
      <Spinner size={props.size ?? loadingStateSpinnerSize(props.variant)} />
      <Show when={props.caption !== undefined && props.caption !== null}>
        <p class="text textCaption text-center">{props.caption}</p>
      </Show>
    </StateBlock>
  );
}
