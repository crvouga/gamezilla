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
import { useTheme } from '../../theme';
import type { SxProps } from '../../theme';

export type CenterProps = ViewProps & {
  /** Utility-first style shorthand. */
  sx?: SxProps;
};

export const Center = forwardRef<View, CenterProps>(function Center(
  { sx: sxProp, style, ...rest },
  ref
) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  return (
    <View
      ref={ref}
      style={[
        { alignItems: 'center', justifyContent: 'center' },
        sxStyle,
        style,
      ]}
      {...rest}
    />
  );
});
