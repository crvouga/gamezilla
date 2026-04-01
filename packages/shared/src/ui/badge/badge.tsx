/**
 * `Badge` -- small status indicator or count label.
 *
 * @example
 * ```tsx
 * <Badge label="New" color="success" />
 * <Badge label="3" color="destructive" />
 * ```
 */

import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';

export type BadgeProps = {
  /** Text displayed inside the badge. */
  label: string;
  /** Color token or raw color for the background. Defaults to `"tint"`. */
  color?: string;
  /** Size preset. Defaults to `"md"`. */
  size?: 'sm' | 'md';
};

export function Badge({ label, color = 'tint', size = 'md' }: BadgeProps) {
  const theme = useTheme();
  const bg = theme.colors[color as keyof typeof theme.colors] ?? color;

  const isSmall = size === 'sm';
  const px = isSmall ? 6 : 8;
  const py = isSmall ? 1 : 2;
  const fontSize = isSmall ? 10 : 12;

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: 999,
        paddingHorizontal: px,
        paddingVertical: py,
      }}
    >
      <Text style={{ color: theme.colors.paper, fontSize, fontWeight: 'bold' }}>
        {label}
      </Text>
    </View>
  );
}
