/**
 * `Center` -- centers children on both axes.
 *
 * @example
 * ```tsx
 * <Center sx={{ flex: 1 }}>
 *   <Spinner />
 * </Center>
 * ```
 */

import { forwardRef } from 'react';
import type { View } from 'react-native';
import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Box, type BoxProps } from '../box';

export type CenterProps = Omit<BoxProps, 'sx'> & {
  /** Utility-first style shorthand. */
  sx?: SxInput;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export const Center = forwardRef<View, CenterProps>(function Center(
  { sx, dataSet, ...rest },
  ref
) {
  return (
    <Box
      ref={ref}
      sx={[{ alignItems: 'center', justifyContent: 'center' }, sx]}
      dataSet={{ component: 'Center', ...dataSet }}
      {...rest}
    />
  );
});
