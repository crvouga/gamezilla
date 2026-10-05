/** @jsxImportSource solid-js */
/**
 * `SpinnerBox` -- centered loading layout primitive.
 *
 * Use anywhere a `Spinner` was previously wrapped in a `Box`/`Center`/`Stack`
 * to center it (with optional caption underneath).
 *
 * @example
 * ```tsx
 * <SpinnerBox class="flex-1" />
 * <SpinnerBox class="p-6" size="large">
 *   <Text variant="caption" label="Loading entity…" />
 * </SpinnerBox>
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import type { SpinnerProps } from './spinner';
import { Spinner } from './spinner';

export type SpinnerBoxProps = {
  /** Extra classes on the centering wrapper. */
  class?: string | undefined;
  /** Inline styles on the centering wrapper. */
  style?: JSX.CSSProperties | undefined;
  /** Spinner size; defaults to `"medium"` (matches `Spinner`). */
  size?: SpinnerProps['size'];
  /** Spinner color token or raw color; defaults to `"tint"`. */
  color?: SpinnerProps['color'];
  /** Spinner stroke width override. */
  strokeWidth?: SpinnerProps['strokeWidth'];
  /** Optional caption/content rendered below the spinner. */
  children?: JSX.Element | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function SpinnerBox(props: SpinnerBoxProps): JSX.Element {
  return (
    <div
      class="box items-center justify-center gap-2"
      classList={{ [String(props.class)]: true }}
      {...dataAttrs({ component: 'SpinnerBox', ...props.dataSet })}
      style={props.style}
    >
      <Spinner
        size={props.size}
        color={props.color}
        strokeWidth={props.strokeWidth}
      />
      {props.children}
    </div>
  );
}
