/**
 * `Divider` -- a thin line separator.
 *
 * Renders a horizontal or vertical divider using the `border` color token.
 *
 * @example
 * ```tsx
 * <Stack spacing={2}>
 *   <Text>Above</Text>
 *   <Divider />
 *   <Text>Below</Text>
 * </Stack>
 * ```
 */

import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Box, type BoxProps } from '../box';

export type DividerProps = Omit<BoxProps, 'sx'> & {
  /** Orientation. Defaults to `"horizontal"`. */
  orientation?: 'horizontal' | 'vertical';
  /** Utility-first style shorthand. */
  sx?: SxInput;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function Divider({
  orientation = 'horizontal',
  sx,
  dataSet,
  ...rest
}: DividerProps) {
  const lineSx =
    orientation === 'horizontal'
      ? { width: '100%' as const, borderBottomWidth: 'hairline' as const }
      : { height: '100%' as const, borderLeftWidth: 1 };
  return (
    <Box
      sx={[lineSx, { borderColor: 'border' }, sx]}
      dataSet={{ component: 'Divider', ...dataSet }}
      {...rest}
    />
  );
}
