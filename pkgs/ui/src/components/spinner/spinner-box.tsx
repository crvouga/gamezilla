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

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box, joinClass } from '../box';
import { Spinner, type SpinnerProps } from './spinner';

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
    <Box
      class={joinClass('items-center justify-center gap-2', props.class)}
      style={props.style}
      dataSet={{ component: 'SpinnerBox', ...props.dataSet }}
    >
      <Spinner
        size={props.size}
        color={props.color}
        strokeWidth={props.strokeWidth}
      />
      {props.children}
    </Box>
  );
}
