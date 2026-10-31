/** @jsxImportSource solid-js */

import { iconSize } from '@pkgs/ui-root-shared-ts/sizes';
import type {
  ColorTone,
  IconSizeToken,
} from '@pkgs/ui-root-shared-ts/token-names';
import { textToneColor } from '@pkgs/ui-root-shared-ts/tones';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { IconComponent } from '../create-icon/index';

export type IconGlyphProps = {
  /** The icon component to draw. */
  icon: IconComponent;
  /** Default `lg` (24). */
  size?: IconSizeToken | undefined;
  /** Unset follows the surrounding surface. */
  tone?: ColorTone | undefined;
  /** A heavier stroke, for the chosen item of a set. */
  bold?: boolean | undefined;
  /** Accessible name. Unset, the icon is decorative. */
  label?: string | undefined;
};

const STROKE_BOLD = 2.5;

function toneColor(tone: ColorTone | undefined): string | undefined {
  if (tone === undefined) return undefined;
  return tone === 'inherit' ? 'currentColor' : textToneColor[tone];
}

/**
 * `Icon` -- renders an icon component chosen at run time, at a token size
 * and in a tone. It is how a screen draws an icon it holds in a value (a
 * row's `icon`, a tab's `Icon`), which a JSX tag cannot do reactively.
 *
 * An icon named in the source is written directly (`<ClockIcon />`). Unset,
 * `tone` follows the surface the icon sits on, so an icon in a filled button
 * matches the label.
 *
 * @example
 * ```tsx
 * <Icon icon={props.row.icon} size="md" />
 * <Icon icon={muted() ? VolumeXIcon : Volume2Icon} tone="secondary" label={t`Sound`} />
 * ```
 */
export function Icon(props: IconGlyphProps): JSX.Element {
  return (
    <Dynamic
      component={props.icon}
      size={iconSize[props.size ?? 'lg']}
      color={toneColor(props.tone)}
      strokeWidth={props.bold === true ? STROKE_BOLD : undefined}
      label={props.label}
    />
  );
}
