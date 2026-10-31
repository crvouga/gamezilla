/** @jsxImportSource solid-js */
/**
 * Icon adapter over `lucide-solid`. Every icon in the design system is a
 * `createIcon(LucideX)` so consumers get theme-aware color defaults.
 *
 * Default stroke is the CSS var `--ui-on-icon` (set by {@link OnColorProvider}),
 * not a JS context read. That way icons created as JSX outside a colored
 * surface (e.g. `Button` `endIcon={<ChevronRightIcon />}`) still pick up the
 * surface foreground when inserted — matching the label color.
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { componentDataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { resolveColor } from '@pkgs/ui-root-shared-ts/resolve-color';
import type { Component, JSX } from 'solid-js';
import { useThemeTokens } from '../theme-context/index';

export type IconProps = {
  size?: number | undefined;
  /** Color token name or CSS color. When omitted, uses `var(--ui-on-icon)`. */
  color?: string | undefined;
  strokeWidth?: number | undefined;
  /** Accessible name; omitted icons are `aria-hidden` (decorative). */
  label?: string | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export type IconComponent = Component<IconProps>;

const DEFAULT_SIZE = 24;
const DEFAULT_STROKE_WIDTH = 2;
/** Cascade-friendly default; {@link OnColorProvider} overrides per surface. */
const DEFAULT_ICON_COLOR = 'var(--ui-on-icon)';

type LucideIconLike = Component<{
  size?: number | string;
  color?: string;
  'stroke-width'?: number | string;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

export function createIcon(LucideIcon: LucideIconLike): IconComponent {
  return function Icon(props: IconProps): JSX.Element {
    const tokens = useThemeTokens();
    const color = (): string => {
      if (props.color === undefined) return DEFAULT_ICON_COLOR;
      return resolveColor(props.color, tokens.colors) ?? DEFAULT_ICON_COLOR;
    };
    return (
      <span
        class="box inline-flex items-center justify-center shrink-0"
        role={props.label === undefined ? undefined : 'img'}
        aria-label={props.label}
        aria-hidden={props.label === undefined ? true : undefined}
        {...componentDataAttrs('Icon', props.dataSet)}
      >
        <LucideIcon
          size={props.size ?? DEFAULT_SIZE}
          color={color()}
          stroke-width={props.strokeWidth ?? DEFAULT_STROKE_WIDTH}
        />
      </span>
    );
  };
}
