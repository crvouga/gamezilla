/** @jsxImportSource solid-js */
/**
 * `SpinnerBox` -- centered loading layout primitive.
 *
 * Use anywhere a `Spinner` was previously wrapped in a `Box`/`Center`/`Stack`
 * to center it (with optional caption underneath).
 *
 * @example
 * ```tsx
 * <SpinnerBox sx={{ flex: 1 }} />
 * <SpinnerBox sx={{ p: 6 }} size="large">
 *   <Text variant="caption" label="Loading entity…" />
 * </SpinnerBox>
 * ```
 */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Center } from '../center';
import { Spinner, type SpinnerProps } from './spinner';

export type SpinnerBoxProps = {
  /** Utility-first style shorthand applied to the centering wrapper. */
  sx?: SxInput | undefined;
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
    <Center
      sx={[{ gap: 2 }, props.sx]}
      dataSet={{ component: 'SpinnerBox', ...props.dataSet }}
    >
      <Spinner
        size={props.size}
        color={props.color}
        strokeWidth={props.strokeWidth}
      />
      {props.children}
    </Center>
  );
}
