/**
 * `Text` -- themed text primitive with variant system.
 *
 * Wraps React Native `Text` with `sx` prop support and pre-defined
 * typographic variants that map to the theme's font/color scales.
 *
 * @example
 * ```tsx
 * <Text variant="heading" label="Page Title" />
 * <Text variant="caption" sx={{ color: 'textSecondary' }} label="Footnote" />
 * ```
 */

import { forwardRef, type ReactNode } from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import {
  textCasingToStyle,
  useOnColor,
  useTheme,
  type OnColorSet,
  type SxProps,
  type Theme,
} from '../../theme';

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

/**
 * Variants that represent UI chrome (headers, titles, labels) and should
 * pick up the theme's global `textCasing`. Content variants (`body`,
 * `bodyBold`, `caption`, `link`, `mono`) opt out so user-supplied copy --
 * URLs, identifiers, code, proper nouns -- renders verbatim.
 */
const CASING_VARIANTS = new Set<TextVariant>([
  'title',
  'subtitle',
  'heading',
  'navigationTitle',
  'label',
]);

const variantStyles: Record<TextVariant, SxProps> = {
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

function variantFontFamily(
  variant: TextVariant,
  theme: Theme
): { fontFamily?: string } {
  if (variant === 'mono') return { fontFamily: theme.fonts.mono };
  if (ROUNDED_VARIANTS.has(variant)) return { fontFamily: theme.fonts.rounded };
  if (variant === 'bodyBold') {
    return { fontFamily: theme.fonts.sansSemibold ?? theme.fonts.sans };
  }
  return { fontFamily: theme.fonts.sans };
}

/** Variants whose color is a deliberate accent and should ignore on-color. */
const ACCENT_COLOR_VARIANTS = new Set<TextVariant>(['link']);

/**
 * Default text color derived from the surrounding on-color context. Outside a
 * colored surface this resolves to the theme's standard `text` /
 * `textSecondary`, preserving normal screens; on a colored surface it becomes
 * the contrast-safe foreground. Returns `undefined` for accent variants
 * (e.g. `link`) so their variant color wins.
 */
function defaultColorForVariant(
  variant: TextVariant,
  onColor: OnColorSet
): string | undefined {
  if (ACCENT_COLOR_VARIANTS.has(variant)) return undefined;
  if (variant === 'caption') return onColor.fgMuted;
  return onColor.fg;
}

export type TextProps = RNTextProps & {
  /** Typographic variant preset. Defaults to `"body"`. */
  variant?: TextVariant;
  /** Utility-first style shorthand resolved against the current theme. */
  sx?: SxProps;
  /**
   * Primary text content. Prefer this over `children` outside the design-system
   * package so copy is not embedded as JSX text nodes.
   */
  label?: ReactNode;
};

export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = 'body', sx: sxProp, style, label, children, ...rest },
  ref
) {
  const theme = useTheme();
  const onColor = useOnColor();
  const base = theme.sx(variantStyles[variant]);
  const variantFont = variantFontFamily(variant, theme);
  const casingStyle = CASING_VARIANTS.has(variant)
    ? textCasingToStyle(theme.textCasing)
    : undefined;
  const defaultColor = defaultColorForVariant(variant, onColor);
  const colorStyle =
    defaultColor !== undefined ? { color: defaultColor } : undefined;
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const content = label ?? children;
  return (
    <RNText
      ref={ref}
      style={[base, variantFont, casingStyle, colorStyle, sxStyle, style]}
      {...rest}
    >
      {content}
    </RNText>
  );
});
