/**
 * `Spinner` -- themed ActivityIndicator wrapper.
 *
 * @example
 * ```tsx
 * <Spinner size="large" color="tint" />
 * ```
 */

import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';
import { useTheme } from '../../theme';

export type SpinnerProps = Omit<ActivityIndicatorProps, 'color'> & {
  /** Color token name or raw color. Defaults to `"tint"`. */
  color?: string;
};

export function Spinner({ color = 'tint', ...rest }: SpinnerProps) {
  const theme = useTheme();
  const resolved = theme.colors[color as keyof typeof theme.colors] ?? color;
  return <ActivityIndicator color={resolved} {...rest} />;
}
