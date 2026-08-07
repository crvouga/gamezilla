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
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';

export type DividerProps = ViewProps & {
  /** Orientation. Defaults to `"horizontal"`. */
  orientation?: 'horizontal' | 'vertical';
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function Divider({
  orientation = 'horizontal',
  style,
  dataSet,
  ...rest
}: DividerProps) {
  const theme = useTheme();
  const idProps = componentDataSet('Divider', dataSet);

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

  return <View style={[dividerStyle, style]} {...rest} {...idProps} />;
}
