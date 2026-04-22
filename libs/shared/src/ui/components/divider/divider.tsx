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

import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../../theme';

export type DividerProps = ViewProps & {
  /** Orientation. Defaults to `"horizontal"`. */
  orientation?: 'horizontal' | 'vertical';
};

export function Divider({
  orientation = 'horizontal',
  style,
  ...rest
}: DividerProps) {
  const theme = useTheme();

  const dividerStyle =
    orientation === 'horizontal'
      ? {
          height: StyleSheet.hairlineWidth,
          width: '100%' as const,
          backgroundColor: theme.colors.border,
        }
      : {
          width: StyleSheet.hairlineWidth,
          height: '100%' as const,
          backgroundColor: theme.colors.border,
        };

  return <View style={[dividerStyle, style]} {...rest} />;
}
