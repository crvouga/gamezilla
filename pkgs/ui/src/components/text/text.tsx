/** @jsxImportSource solid-js */
/**
 * `Text` -- themed text primitive with variant system.
 *
 * Renders an inline `<span>` (or `as` element) with typographic variants
 * as CSS classes, plus Solid `class` / `classList` / `style`.
 *
 * Empty and whitespace-only strings reserve one line of height (via a
 * zero-width space) so layout stays stable while async data loads.
 *
 * @example
 * ```tsx
 * <Text variant="heading" label="Page Title" />
 * <Text variant="caption" class="text-destructive" label="Error" />
 * ```
 */

import { createMemo, type JSX, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { type ComponentDataSet, componentDataAttrs } from '../../component-id';
import {
  type OnColorSet,
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

const TEXT_VARIANT_CLASS: Record<TextVariant, string | undefined> = {
  body: undefined,
  bodyBold: styles['textBodyBold'],
  caption: styles['textCaption'],
  label: styles['textLabel'],
  title: styles['textTitle'],
  subtitle: styles['textSubtitle'],
  heading: styles['textHeading'],
  navigationTitle: styles['textNavigationTitle'],
  link: styles['textLink'],
  mono: styles['textMono'],
};

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

function lineClampStyle(n: number): JSX.CSSProperties {
  return {
    display: '-webkit-box',
    '-webkit-box-orient': 'vertical',
    '-webkit-line-clamp': n,
    overflow: 'hidden',
  };
}

function mergeHostStyle(
  base: JSX.CSSProperties | string | undefined,
  extras: JSX.CSSProperties
): JSX.CSSProperties | string | undefined {
  if (Object.keys(extras).length === 0) return base;
  if (base === undefined) return extras;
  if (typeof base === 'string') {
    const bits: string[] = [base];
    for (const [key, value] of Object.entries(extras)) {
      if (value === undefined || value === null || value === false) continue;
      const prop = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      bits.push(`${prop}:${String(value)}`);
    }
    return bits.join(';');
  }
  return { ...base, ...extras };
}

export type TextProps = Omit<JSX.HTMLAttributes<HTMLElement>, 'children'> & {
  /** Typographic variant preset. Defaults to `"body"`. */
  variant?: TextVariant | undefined;
  /** Host element. Defaults to `span`. */
  as?: TextElement | undefined;
  /**
   * Primary text content. Prefer this over `children` outside the
   * design-system package so copy is not embedded as JSX text nodes.
   */
  label?: JSX.Element | undefined;
  /** Clamp to N lines with an ellipsis. */
  numberOfLines?: number | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

export function Text(props: TextProps): JSX.Element {
  const tokens = useThemeTokens();
  const onColor = useOnColor();
  const [local, rest] = splitProps(props, [
    'variant',
    'as',
    'label',
    'numberOfLines',
    'dataSet',
    'class',
    'style',
    'children',
  ]);
  const variant = () => local.variant ?? 'body';
  const style = createMemo(() => {
    const v = variant();
    const extras: JSX.CSSProperties = {};
    if (CASING_VARIANTS.has(v)) {
      Object.assign(extras, textCasingToStyle(tokens.textCasing));
    }
    if (local.numberOfLines !== undefined) {
      Object.assign(extras, lineClampStyle(local.numberOfLines));
    }
    const color = defaultColorForVariant(v, onColor());
    if (color !== undefined) extras.color = color;
    return mergeHostStyle(local.style, extras);
  });
  return (
    <Dynamic
      component={local.as ?? 'span'}
      class={joinClass(
        styles['text'],
        TEXT_VARIANT_CLASS[variant()],
        local.class
      )}
      style={style()}
      {...componentDataAttrs('Text', local.dataSet)}
      {...rest}
    >
      {preserveEmptyTextLayout(local.label ?? local.children)}
    </Dynamic>
  );
}
