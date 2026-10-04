/** @jsxImportSource solid-js */
/**
 * `GradientBox` -- `Box` with a CSS linear-gradient fill. Children read a
 * contrast-safe on-color set (defaults to `onPrimary`) via `OnColorProvider`.
 */

import { createMemo, type JSX, splitProps } from 'solid-js';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { componentDataAttrs } from '@pkgs/ui-shared/component-id';
import { bestOnColor, ON_DARK } from '@pkgs/ui-shared/contrast';
import { OnColorProvider } from './on-color-context';
import type { OnColorSet } from '@pkgs/ui-shared/contrast';
import { useThemeTokens } from './theme-context';
import type { GradientPoint } from '@pkgs/ui-shared/gradient-css';
import { linearGradientCss } from '@pkgs/ui-shared/gradient-css';

export type GradientBoxProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'children'
> & {
  /** At least two colors. Defaults to the theme primary gradient. */
  colors?: readonly [string, string, ...string[]] | undefined;
  /** Normalized 0–1; default horizontal left → right. */
  start?: GradientPoint | undefined;
  end?: GradientPoint | undefined;
  /**
   * Derive child text/icon colors via `bestOnColor` from this concrete color
   * instead of the default `onPrimary` set.
   */
  onColor?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

const DEFAULT_START: GradientPoint = { x: 0, y: 0.5 };
const DEFAULT_END: GradientPoint = { x: 1, y: 0.5 };

const BACKGROUND_IMAGE_PREFIX = 'background-image:';

export function GradientBox(props: GradientBoxProps): JSX.Element {
  const tokens = useThemeTokens();
  const [local, rest] = splitProps(props, [
    'colors',
    'start',
    'end',
    'onColor',
    'dataSet',
    'class',
    'style',
    'children',
  ]);
  const colors = (): readonly string[] =>
    local.colors ?? [tokens.colors.tintHover, tokens.colors.tintActive];
  const style = createMemo((): JSX.CSSProperties | string => {
    const gradientDecl = linearGradientCss(
      colors(),
      local.start ?? DEFAULT_START,
      local.end ?? DEFAULT_END
    );
    if (local.style === undefined || local.style === '') return gradientDecl;
    if (typeof local.style === 'string') {
      return `${local.style};${gradientDecl}`;
    }
    const image = gradientDecl.startsWith(BACKGROUND_IMAGE_PREFIX)
      ? gradientDecl.slice(BACKGROUND_IMAGE_PREFIX.length)
      : gradientDecl;
    return { ...local.style, 'background-image': image };
  });
  const onColor = createMemo(
    (): OnColorSet =>
      local.onColor !== undefined
        ? bestOnColor(local.onColor)
        : {
            fg: tokens.colors.onPrimary,
            fgMuted: ON_DARK.fgMuted,
            icon: tokens.colors.onPrimary,
          }
  );
  return (
    <div
      class={['box', local.class].filter(Boolean).join(' ')}
      style={style()}
      {...componentDataAttrs('GradientBox', local.dataSet)}
      {...rest}
    >
      {/* oxlint-disable-next-line solid/reactivity -- OnColorProvider reads `value` inside a memo */}
      <OnColorProvider value={onColor()}>{local.children}</OnColorProvider>
    </div>
  );
}
