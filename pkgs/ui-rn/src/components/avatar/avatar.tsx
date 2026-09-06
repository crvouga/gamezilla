/**
 * `Avatar` -- circular avatar primitive.
 *
 * Renders the first content source provided, in priority order:
 *   `svg` > `uri` > `initials` > `icon` > (empty plate).
 *
 * Always draws a 1px theme `border` ring so faces stay enclosed on any
 * surface (list rows, chrome, empty plates). Outer diameter stays `size`
 * (RN border-box); content is clipped under the ring.
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
 * <Avatar icon={UserIcon} size={48} background="outline" foreground="tabIconDefault" />
 * <Avatar size={48} background="surface" /> // empty placeholder plate
 * ```
 */

import type { ReactNode } from 'react';
import { Image } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { ComponentDataSet } from '../../component-id';
import { bestOnColor, useTheme } from '../../theme';
import { Box } from '../box';
import type { IconComponent } from '../icons';
import { Text } from '../text';

/** Minimal enclosing ring on every avatar face. */
export const AVATAR_BORDER_WIDTH = 1;

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
  icon?: IconComponent;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function AvatarPlate({
  size,
  backgroundColor,
  dataSet,
  children,
}: {
  size: number;
  backgroundColor: string;
  dataSet?: ComponentDataSet;
  children?: ReactNode;
}) {
  return (
    <Box
      dataSet={{ component: 'Avatar', ...dataSet }}
      sx={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: AVATAR_BORDER_WIDTH,
        borderColor: 'border',
        overflow: 'hidden',
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </Box>
  );
}

export function Avatar({
  size = 40,
  background = 'tint',
  foreground,
  svg,
  uri,
  initials,
  icon,
  dataSet,
}: AvatarProps) {
  const theme = useTheme();
  const bg =
    theme.colors[background as keyof typeof theme.colors] ?? background;
  const fg =
    foreground !== undefined
      ? (theme.colors[foreground as keyof typeof theme.colors] ?? foreground)
      : bestOnColor(bg).fg;

  if (isNonEmpty(svg)) {
    return (
      <AvatarPlate
        size={size}
        backgroundColor={bg}
        {...(dataSet !== undefined ? { dataSet } : {})}
      >
        <SvgXml xml={svg} width={size} height={size} />
      </AvatarPlate>
    );
  }

  if (isNonEmpty(uri)) {
    return (
      <AvatarPlate
        size={size}
        backgroundColor={bg}
        {...(dataSet !== undefined ? { dataSet } : {})}
      >
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </AvatarPlate>
    );
  }

  if (isNonEmpty(initials)) {
    const fontSize = Math.round(size * 0.4);
    return (
      <AvatarPlate
        size={size}
        backgroundColor={bg}
        {...(dataSet !== undefined ? { dataSet } : {})}
      >
        <Text
          sx={{ color: fg, fontSize, fontWeight: 'bold' }}
          label={initials.slice(0, 2)}
        />
      </AvatarPlate>
    );
  }

  if (icon !== undefined) {
    const iconSize = Math.max(12, Math.round(size * 0.48));
    const Icon = icon;
    return (
      <AvatarPlate
        size={size}
        backgroundColor={bg}
        {...(dataSet !== undefined ? { dataSet } : {})}
      >
        <Icon size={iconSize} color={fg} />
      </AvatarPlate>
    );
  }

  return (
    <AvatarPlate
      size={size}
      backgroundColor={bg}
      {...(dataSet !== undefined ? { dataSet } : {})}
    />
  );
}
