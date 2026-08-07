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
import { View, type ViewProps } from 'react-native';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import type { SxProps } from '../../theme';
import { useTheme } from '../../theme';

export type CenterProps = ViewProps & {
  /** Utility-first style shorthand. */
  sx?: SxProps;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export const Center = forwardRef<View, CenterProps>(function Center(
  { sx: sxProp, style, dataSet, ...rest },
  ref
) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const idProps = componentDataSet('Center', dataSet);
  return (
    <View
      ref={ref}
      style={[
        { alignItems: 'center', justifyContent: 'center' },
        sxStyle,
        style,
      ]}
      {...rest}
      {...idProps}
    />
  );
});
