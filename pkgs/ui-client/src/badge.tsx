/** @jsxImportSource solid-js */
/**
 * `Badge` -- small status indicator or count label.
 *
 * @example
 * ```tsx
 * <Badge label="New" intent="success" />
 * <Badge label="3" intent="brand" tone="solid" size="sm" />
 * ```
 */

import { createMemo, type JSX } from 'solid-js';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { bestOnColor } from '@pkgs/ui-shared/contrast';
import { resolveColor } from '@pkgs/ui-shared/resolve-color';
import { useThemeTokens } from './theme-context';

export type BadgeIntent =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info';

export type BadgeTone = 'subtle' | 'solid';

export type BadgeSize = 'sm' | 'md';

export type BadgeProps = {
  /** Text displayed inside the badge. */
  label: JSX.Element;
  /** Semantic intent. Defaults to `"brand"`. */
  intent?: BadgeIntent | undefined;
  /** Visual weight. Defaults to `"subtle"`. */
  tone?: BadgeTone | undefined;
  /**
   * Optional raw color override (palette token name or any CSS color).
   * When set, supersedes `intent` and renders solid with an auto-contrast
   * label.
   */
  color?: string | undefined;
  /** Size preset. Defaults to `"md"`. */
  size?: BadgeSize | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function Badge(props: BadgeProps): JSX.Element {
  const tokens = useThemeTokens();
  const custom = createMemo((): { bg: string; fg: string } | null => {
    if (props.color === undefined) return null;
    const raw = resolveColor(props.color, tokens.palette()) ?? props.color;
    return {
      bg: resolveColor(props.color, tokens.colors) ?? props.color,
      fg: bestOnColor(raw).fg,
    };
  });
  const tone = (): string =>
    props.color !== undefined ? 'custom' : (props.tone ?? 'subtle');
  const paint = (): JSX.CSSProperties | undefined => {
    const colors = custom();
    if (colors === null) return undefined;
    return { 'background-color': colors.bg, color: colors.fg };
  };

  return (
    <span
      class="badge box inline-flex self-start items-center justify-center"
      {...dataAttrs({
        component: 'Badge',
        intent: props.intent ?? 'brand',
        tone: tone(),
        size: props.size ?? 'md',
        ...props.dataSet,
      })}
      style={paint()}
    >
      <p class="text font-bold">{props.label}</p>
    </span>
  );
}
