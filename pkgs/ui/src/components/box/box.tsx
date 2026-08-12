/**
 * `Box` -- the foundational layout primitive.
 *
 * A themed `View` that accepts an `sx` prop for utility-first styling
 * and resolves color tokens from the current theme.
 *
 * @example
 * ```tsx
 * <Box sx={{ p: 4, background: 'surface', borderRadius: 8 }}>
 *   <Text>Hello</Text>
 * </Box>
 * ```
 */

import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';
import type { ComponentDataSet } from '../../component-id';
import { type SxInput, useHostSx } from '../../theme';

export type BoxProps = Omit<ViewProps, 'style'> & {
  /** Utility-first style shorthand resolved against the current theme. */
  sx?: SxInput;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export const Box = forwardRef<View, BoxProps>(function Box(
  { sx, dataSet, ...rest },
  ref
) {
  const host = useHostSx('Box', sx, dataSet);
  return <View ref={ref} style={host.style} {...rest} {...host.dataSet} />;
});
