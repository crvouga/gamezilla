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
import { useTheme } from '../../theme';
import type { SxProps, Theme } from '../../theme';

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

const variantStyles: Record<TextVariant, SxProps> = {
  body: { fontSize: 'base', lineHeight: 26, color: 'text' },
  bodyBold: { fontSize: 'base', lineHeight: 26, fontWeight: '600', color: 'text' },
  caption: { fontSize: 'xs', lineHeight: 18, color: 'textSecondary' },
  label: { fontSize: 'sm', lineHeight: 22, fontWeight: '500', color: 'text' },
  title: { fontSize: '4xl', fontWeight: '800', lineHeight: 44, color: 'text' },
  subtitle: { fontSize: 'xl', fontWeight: '800', lineHeight: 28, color: 'text' },
  heading: { fontSize: '2xl', fontWeight: '800', lineHeight: 34, color: 'text' },
  navigationTitle: {
    fontSize: 'lg',
    lineHeight: 24,
    fontWeight: '600',
    color: 'text',
  },
  link: { fontSize: 'base', lineHeight: 26, color: 'tint' },
  mono: { fontSize: 'sm', lineHeight: 22, color: 'text' },
};

function variantFontFamily(
  variant: TextVariant,
  theme: Theme
): { fontFamily?: string } {
  if (variant === 'mono') {
    return { fontFamily: theme.fonts.mono };
  }
  if (
    variant === 'title' ||
    variant === 'subtitle' ||
    variant === 'heading' ||
    variant === 'label' ||
    variant === 'navigationTitle' ||
    variant === 'link' ||
    variant === 'caption'
  ) {
    return { fontFamily: theme.fonts.rounded };
  }
  if (variant === 'bodyBold') {
    const semi = theme.fonts.sansSemibold;
    return semi !== undefined
      ? { fontFamily: semi }
      : { fontFamily: theme.fonts.sans };
  }
  return { fontFamily: theme.fonts.sans };
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
  ref,
) {
  const theme = useTheme();
  const base = theme.sx(variantStyles[variant]);
  const variantFont = variantFontFamily(variant, theme);
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const content = label ?? children;
  return (
    <RNText ref={ref} style={[base, variantFont, sxStyle, style]} {...rest}>
      {content}
    </RNText>
  );
});
