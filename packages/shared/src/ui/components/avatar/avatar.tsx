/**
 * `Avatar` -- circular avatar with image or initials fallback.
 *
 * @example
 * ```tsx
 * <Avatar uri="https://example.com/photo.jpg" size={48} />
 * <Avatar initials="JD" size={48} />
 * ```
 */

import { Image, View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';

export type AvatarProps = {
  /** Image URI. When absent, falls back to `initials`. */
  uri?: string;
  /** 1-2 character fallback when no image. */
  initials?: string;
  /** Diameter in pixels. Defaults to 40. */
  size?: number;
  /** Background color token or raw color for the initials circle. */
  background?: string;
};

export function Avatar({
  uri,
  initials,
  size = 40,
  background = 'tint',
}: AvatarProps) {
  const theme = useTheme();
  const bg = theme.colors[background as keyof typeof theme.colors] ?? background;

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden' as const,
    backgroundColor: bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (uri) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>
    );
  }

  const fontSize = Math.round(size * 0.4);
  return (
    <View style={containerStyle}>
      <Text
        style={{ color: theme.colors.paper, fontSize, fontWeight: 'bold' }}
        label={(initials ?? '?').slice(0, 2)}
      />
    </View>
  );
}
