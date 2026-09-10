/** @jsxImportSource solid-js */
/**
 * Icon adapter over `lucide-solid`. Every icon in the design system is a
 * `createIcon(LucideX)` so consumers get theme-aware color defaults (on-color
 * context → `icon` token) and a layout box via `class` / `style`.
 */

import type { Component, JSX } from 'solid-js';
import { type ComponentDataSet, componentDataAttrs } from '../../component-id';
import { resolveColor, useOnColor, useThemeTokens } from '../../theme';
import { Box, joinClass } from '../box';

export type IconProps = {
  size?: number | undefined;
  /** Color token name or CSS color. When omitted, inherits on-color context or theme `icon`. */
  color?: string | undefined;
  strokeWidth?: number | undefined;
  class?: string | undefined;
  style?: JSX.CSSProperties | undefined;
  /** Accessible name; omitted icons are `aria-hidden` (decorative). */
  label?: string | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export type IconComponent = Component<IconProps>;

const DEFAULT_SIZE = 24;
const DEFAULT_STROKE_WIDTH = 2;

type LucideIconLike = Component<{
  size?: number | string;
  color?: string;
  'stroke-width'?: number | string;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

export function createIcon(LucideIcon: LucideIconLike): IconComponent {
  return function Icon(props: IconProps): JSX.Element {
    const tokens = useThemeTokens();
    const onColor = useOnColor();
    const color = (): string =>
      (props.color !== undefined
        ? resolveColor(props.color, tokens.colors)
        : undefined) ?? onColor().icon;
    return (
      <Box
        as="span"
        role={props.label === undefined ? undefined : 'img'}
        aria-label={props.label}
        aria-hidden={props.label === undefined ? true : undefined}
        class={joinClass(
          'inline-flex items-center justify-center shrink-0',
          props.class
        )}
        style={props.style}
        {...componentDataAttrs('Icon', props.dataSet)}
      >
        <LucideIcon
          size={props.size ?? DEFAULT_SIZE}
          color={color()}
          stroke-width={props.strokeWidth ?? DEFAULT_STROKE_WIDTH}
        />
      </Box>
    );
  };
}
