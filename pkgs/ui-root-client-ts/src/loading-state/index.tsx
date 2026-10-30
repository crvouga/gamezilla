/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import type { SpinnerProps } from '../spinner/index';
import { Spinner } from '../spinner/index';
import type { StateBlockVariant } from '../state-block/index';
import { StateBlock } from '../state-block/index';

export type LoadingStateProps = {
  /** Optional caption rendered under the spinner. */
  caption?: JSX.Element | undefined;
  /** Layout density. Defaults to `'fill'`. */
  variant?: StateBlockVariant | undefined;
  /** Spinner size. Defaults to `md`, `lg` for a whole screen. */
  size?: SpinnerProps['size'];
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `LoadingState` -- canonical async loading block.
 *
 * The one block a screen, section or sheet shows while it waits: the
 * `Spinner` with an optional caption underneath. Two variants:
 *   - `'fill'`    (default) -- centered Spinner inside `flex: 1`. Use for
 *                              full-screen Suspense fallbacks and screen-level
 *                              loads.
 *   - `'compact'` -- intrinsic height, padded. Use inline inside a `Card` or
 *                    section.
 *
 * @example
 * ```tsx
 * <Suspense fallback={<LoadingState size="lg" />}>{children}</Suspense>
 * <LoadingState caption={t`Loading entity…`} />
 * <LoadingState variant="compact" caption={t`Waiting for metrics…`} />
 * ```
 */
export function LoadingState(props: LoadingStateProps): JSX.Element {
  return (
    <StateBlock
      variant={props.variant}
      dataSet={{ component: 'LoadingState', ...props.dataSet }}
    >
      <Spinner size={props.size ?? 'md'} />
      <Show when={props.caption !== undefined && props.caption !== null}>
        <p class="text textCaption text-center">{props.caption}</p>
      </Show>
    </StateBlock>
  );
}
