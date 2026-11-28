/** @jsxImportSource @solidjs/web */
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { componentDataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { resolveColor } from '@pkgs/ui-root-shared-ts/resolve-color';
import type { JSX } from '@solidjs/web';
import type { Component } from 'solid-js';
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

const DEFAULT_SIZE = 20;
/** Cascade-friendly default; {@link OnColorProvider} overrides per surface. */
const DEFAULT_ICON_COLOR = 'var(--ui-on-icon)';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const sprite = new URL('./fluent-regular.svg', import.meta.url).href;

export function createIcon(symbol: string): IconComponent {
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
        aria-hidden={props.label === undefined ? 'true' : undefined}
        {...componentDataAttrs('Icon', props.dataSet)}
      >
        <svg
          xmlns={SVG_NAMESPACE}
          width={props.size ?? DEFAULT_SIZE}
          height={props.size ?? DEFAULT_SIZE}
          viewBox="0 0 20 20"
          fill={color()}
          stroke={color()}
          stroke-width={Math.max(0, (props.strokeWidth ?? 2) - 2) / 2}
          aria-hidden="true"
          focusable="false"
        >
          <use href={`${sprite}#${symbol}`} />
        </svg>
      </span>
    );
  };
}
