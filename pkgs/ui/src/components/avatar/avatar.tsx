/**
 * `Avatar` -- circular avatar primitive.
 *
 * Renders the first content source provided, in priority order:
 *   `svg` > `uri` > `initials` > `icon` > (empty plate).
 *
 * Color props (`background`, `foreground`) accept either a theme color
 * token name (e.g. `'tint'`, `'surface'`, `'outline'`) or a raw color
 * string (e.g. `'#fff'`, `'rgba(255,255,255,0.2)'`).
 *
 * @example
 * ```tsx
 * <Avatar uri="https://example.com/photo.jpg" size={48} />
 * <Avatar initials="JD" size={48} />
 * <Avatar svg={dicebearSvgString} size={64} />
 * <Avatar icon="person.fill" size={48} background="outline" foreground="tabIconDefault" />
 * <Avatar size={48} background="surface" /> // empty placeholder plate
 * ```
 */

import { Image, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { bestOnColor, useTheme } from '../../theme';
import { IconSymbol, type IconSymbolName } from '../symbol-icon';
import { Text } from '../text';

export type AvatarProps = {
  /** Diameter in pixels. Defaults to `40`. */
  size?: number;
  /** Background color token or raw color. Defaults to `'tint'`. */
  background?: string;
  /**
   * Foreground (icon / initials) color token or raw color. When omitted it is
   * auto-derived from `background` for a contrast-safe label in both schemes.
   */
  foreground?: string;
  /**
   * Raw SVG XML string (e.g. from a generative avatar library such as
   * DiceBear). Highest-priority content source.
   */
  svg?: string | null;
  /** Image URI to render inside the circle. */
  uri?: string;
  /** 1–2 character text fallback (truncated to 2 chars). */
  initials?: string;
  /** Icon glyph fallback (e.g. `'person.fill'`). */
  icon?: IconSymbolName;
};

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function Avatar({
  size = 40,
  background = 'tint',
  foreground,
  svg,
  uri,
  initials,
  icon,
}: AvatarProps) {
  const theme = useTheme();
  const bg =
    theme.colors[background as keyof typeof theme.colors] ?? background;
  const fg =
    foreground !== undefined
      ? (theme.colors[foreground as keyof typeof theme.colors] ?? foreground)
      : bestOnColor(bg).fg;

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden' as const,
    backgroundColor: bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (isNonEmpty(svg)) {
    return (
      <View style={containerStyle}>
        <SvgXml xml={svg} width={size} height={size} />
      </View>
    );
  }

  if (isNonEmpty(uri)) {
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

  if (isNonEmpty(initials)) {
    const fontSize = Math.round(size * 0.4);
    return (
      <View style={containerStyle}>
        <Text
          style={{ color: fg, fontSize, fontWeight: 'bold' }}
          label={initials.slice(0, 2)}
        />
      </View>
    );
  }

  if (icon !== undefined) {
    const iconSize = Math.max(12, Math.round(size * 0.48));
    return (
      <View style={containerStyle}>
        <IconSymbol name={icon} size={iconSize} color={fg} />
      </View>
    );
  }

  return <View style={containerStyle} />;
}
