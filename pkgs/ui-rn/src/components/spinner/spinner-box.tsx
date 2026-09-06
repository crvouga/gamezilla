/**
 * `SpinnerBox` -- centered loading layout primitive.
 *
 * Use anywhere a `Spinner` was previously wrapped in a `Box`/`Center`/`Stack`
 * to center it (with optional caption underneath). Combined with
 * `SpinnerProvider` the spinner rotation persists across remounts of sibling
 * loading states, so the animation does not visibly restart.
 *
 * @example
 * ```tsx
 * <SpinnerBox sx={{ flex: 1 }} />
 * <SpinnerBox sx={{ p: 6 }} size="large">
 *   <Text variant="caption" label="Loading entity…" />
 * </SpinnerBox>
 * ```
 */

import type { ReactNode } from 'react';

import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Center } from '../center';
import { Spinner, type SpinnerProps } from './spinner';

export type SpinnerBoxProps = {
  /** Utility-first style shorthand applied to the centering wrapper. */
  sx?: SxInput;
  /** Spinner size; defaults to `"medium"` (matches `Spinner`). */
  size?: SpinnerProps['size'];
  /** Spinner color token or raw color; defaults to `"tint"`. */
  color?: SpinnerProps['color'];
  /** Spinner stroke width override. */
  strokeWidth?: SpinnerProps['strokeWidth'];
  /** Optional caption/content rendered below the spinner. */
  children?: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function SpinnerBox({
  sx,
  size,
  color,
  strokeWidth,
  children,
  dataSet,
}: SpinnerBoxProps) {
  const spinnerProps: SpinnerProps = {};
  if (size !== undefined) spinnerProps.size = size;
  if (color !== undefined) spinnerProps.color = color;
  if (strokeWidth !== undefined) spinnerProps.strokeWidth = strokeWidth;

  return (
    <Center sx={sx} dataSet={{ component: 'SpinnerBox', ...dataSet }}>
      <Spinner {...spinnerProps} />
      {children}
    </Center>
  );
}
