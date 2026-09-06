/** @jsxImportSource solid-js */
/**
 * `Text` -- themed text primitive with variant system.
 *
 * Renders an inline `<span>` (or `as` element) with `sx` prop support and
 * pre-defined typographic variants mapped to the theme's font/color scales.
 *
 * Empty and whitespace-only strings reserve one line of height (via a
 * zero-width space) so layout stays stable while async data loads.
 *
 * @example
 * ```tsx
 * <Text variant="heading" label="Page Title" />
 * <Text variant="caption" sx={{ color: 'destructive' }} label="Error" />
 * ```
 */

import { createMemo, type JSX, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { type ComponentDataSet, componentDataAttrs } from '../../component-id';
import {
  flattenSx,
  type OnColorSet,
  resolveColor,
  type SxInput,
  type SxProps,
  type ThemeTokens,
  textCasingToStyle,
  useOnColor,
  useThemeTokens,
} from '../../theme';
import { joinClass } from '../box/box';
import styles from '../hosts.module.css';
import { preserveEmptyTextLayout } from './preserve-empty-text-layout';

export type TextVariant =
  | 'body'
  | 'bodyBold'
  | 'caption'
  | 'label'
  | 'title'
  | 'subtitle'
  | 'heading'
  /** Compact navigation bar title (stack headers, not page heroes). */
  | 'navigationTitle'
  | 'link'
  | 'mono';

export type TextElement =
  | 'span'
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'label'
  | 'strong'
  | 'em'
  | 'code'
  | 'time';

/**
 * Variants that represent UI chrome and pick up the theme's global
 * `textCasing`. Content variants opt out so user copy renders verbatim.
 */
const CASING_VARIANTS = new Set<TextVariant>([
  'title',
  'subtitle',
  'heading',
  'navigationTitle',
  'label',
]);

export const TEXT_VARIANT_STYLES: Record<TextVariant, SxProps> = {
  body: { fontSize: 'base', lineHeight: 26, color: 'text' },
  bodyBold: {
    fontSize: 'base',
    lineHeight: 26,
    fontWeight: '600',
    color: 'text',
  },
  caption: { fontSize: 'xs', lineHeight: 18, color: 'textSecondary' },
  label: { fontSize: 'sm', lineHeight: 22, fontWeight: '500', color: 'text' },
  title: { fontSize: '4xl', fontWeight: '800', lineHeight: 44, color: 'text' },
  subtitle: {
    fontSize: 'xl',
    fontWeight: '800',
    lineHeight: 28,
    color: 'text',
  },
  heading: {
    fontSize: '2xl',
    fontWeight: '800',
    lineHeight: 34,
    color: 'text',
  },
  navigationTitle: {
    fontSize: 'lg',
    lineHeight: 24,
    fontWeight: '600',
    color: 'text',
  },
  link: { fontSize: 'base', lineHeight: 26, color: 'tint' },
  mono: { fontSize: 'sm', lineHeight: 22, color: 'text' },
};

const ROUNDED_VARIANTS = new Set<TextVariant>([
  'title',
  'subtitle',
  'heading',
  'label',
  'navigationTitle',
  'link',
  'caption',
]);

function variantFontFamily(variant: TextVariant, tokens: ThemeTokens): SxProps {
  if (variant === 'mono') return { fontFamily: tokens.fonts.mono };
  if (ROUNDED_VARIANTS.has(variant)) {
    return { fontFamily: tokens.fonts.rounded };
  }
  return { fontFamily: tokens.fonts.sans };
}

/** Variants whose color is a deliberate accent and should ignore on-color. */
const ACCENT_COLOR_VARIANTS = new Set<TextVariant>(['link']);

function defaultColorForVariant(
  variant: TextVariant,
  onColor: OnColorSet
): string | undefined {
  if (ACCENT_COLOR_VARIANTS.has(variant)) return undefined;
  if (variant === 'caption') return onColor.fgMuted;
  return onColor.fg;
}

export type TextProps = Omit<
  JSX.HTMLAttributes<HTMLElement>,
  'style' | 'children'
> & {
  /** Typographic variant preset. Defaults to `"body"`. */
  variant?: TextVariant | undefined;
  /** Host element. Defaults to `span`. */
  as?: TextElement | undefined;
  /** Utility-first style shorthand resolved against the current theme. */
  sx?: SxInput | undefined;
  /**
   * Primary text content. Prefer this over `children` outside the
   * design-system package so copy is not embedded as JSX text nodes.
   */
  label?: JSX.Element | undefined;
  /** Clamp to N lines with an ellipsis. */
  numberOfLines?: number | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  class?: string | undefined;
  ref?: ((el: HTMLElement) => void) | undefined;
  children?: JSX.Element | undefined;
};

function sxWithoutColor(sx: SxProps | undefined): SxProps | false {
  if (sx === undefined) return false;
  if (sx.color === undefined) return sx;
  const { color: _ignored, ...rest } = sx;
  return Object.keys(rest).length > 0 ? rest : false;
}

export function Text(props: TextProps): JSX.Element {
  const tokens = useThemeTokens();
  const onColor = useOnColor();
  const [local, rest] = splitProps(props, [
    'variant',
    'as',
    'sx',
    'label',
    'numberOfLines',
    'dataSet',
    'class',
    'children',
  ]);
  const variant = () => local.variant ?? 'body';
  const style = createMemo(() => {
    const v = variant();
    const flat = flattenSx(local.sx);
    const sxColor =
      flat?.color !== undefined
        ? resolveColor(flat.color, tokens.colors)
        : undefined;
    const clamp: SxProps | false =
      local.numberOfLines !== undefined
        ? { lineClamp: local.numberOfLines }
        : false;
    return tokens.css([
      TEXT_VARIANT_STYLES[v],
      variantFontFamily(v, tokens),
      CASING_VARIANTS.has(v) ? textCasingToStyle(tokens.textCasing) : false,
      sxWithoutColor(flat),
      clamp,
      {
        color:
          sxColor ??
          defaultColorForVariant(v, onColor()) ??
          TEXT_VARIANT_STYLES[v].color ??
          'text',
      },
    ]);
  });
  return (
    <Dynamic
      component={local.as ?? 'span'}
      class={joinClass(styles['text'], local.class)}
      style={style()}
      {...componentDataAttrs('Text', local.dataSet)}
      {...rest}
    >
      {preserveEmptyTextLayout(local.label ?? local.children)}
    </Dynamic>
  );
}
