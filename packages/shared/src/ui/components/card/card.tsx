/**
 * `Card` -- a surface container with optional elevation and border.
 *
 * @example
 * ```tsx
 * <Card elevation={2} sx={{ p: 4 }}>
 *   <Text variant="subtitle">Title</Text>
 *   <Text>Card body content</Text>
 * </Card>
 * ```
 */

import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme, type SxProps } from '../../theme';
import {
  borderRadius,
  elevation as elevationFn,
  type ElevationLevel,
} from '../../theme/scale';

export type CardProps = ViewProps & {
  /** Shadow depth 0-4. Defaults to 1. */
  elevation?: ElevationLevel;
  /** Utility-first style shorthand. */
  sx?: SxProps;
};

export const Card = forwardRef<View, CardProps>(function Card(
  { elevation: level = 1, sx: sxProp, style, ...rest },
  ref
) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const shadow = elevationFn(level);

  return (
    <View
      ref={ref}
      style={[
        shadow,
        sxStyle,
        style,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: borderRadius.lg,
          borderWidth: level === 0 ? 1 : 0,
          borderColor: theme.colors.border,
        },
      ]}
      {...rest}
    />
  );
});
