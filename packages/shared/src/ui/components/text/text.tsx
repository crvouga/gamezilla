/**
 * `Text` -- themed text primitive with variant system.
 *
 * Wraps React Native `Text` with `sx` prop support and pre-defined
 * typographic variants that map to the theme's font/color scales.
 *
 * @example
 * ```tsx
 * <Text variant="heading">Page Title</Text>
 * <Text variant="caption" sx={{ color: 'textSecondary' }}>Footnote</Text>
 * ```
 */

import { forwardRef } from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '../../theme';
import type { SxProps } from '../../theme';

export type TextVariant =
  | 'body'
  | 'bodyBold'
  | 'caption'
  | 'label'
  | 'title'
  | 'subtitle'
  | 'heading'
  | 'link'
  | 'mono';

const variantStyles: Record<TextVariant, SxProps> = {
  body: { fontSize: 'base', lineHeight: 24, color: 'text' },
  bodyBold: { fontSize: 'base', lineHeight: 24, fontWeight: '600', color: 'text' },
  caption: { fontSize: 'xs', lineHeight: 16, color: 'textSecondary' },
  label: { fontSize: 'sm', lineHeight: 20, fontWeight: '500', color: 'text' },
  title: { fontSize: '4xl', fontWeight: 'bold', lineHeight: 40, color: 'text' },
  subtitle: { fontSize: 'xl', fontWeight: 'bold', color: 'text' },
  heading: { fontSize: '2xl', fontWeight: 'bold', lineHeight: 32, color: 'text' },
  link: { fontSize: 'base', lineHeight: 24, color: 'tint' },
  mono: { fontSize: 'sm', lineHeight: 20, color: 'text' },
};

export type TextProps = RNTextProps & {
  /** Typographic variant preset. Defaults to `"body"`. */
  variant?: TextVariant;
  /** Utility-first style shorthand resolved against the current theme. */
  sx?: SxProps;
};

export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = 'body', sx: sxProp, style, ...rest },
  ref,
) {
  const theme = useTheme();
  const base = theme.sx(variantStyles[variant]);
  const monoFont = variant === 'mono' ? { fontFamily: theme.fonts.mono } : undefined;
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  return <RNText ref={ref} style={[base, monoFont, sxStyle, style]} {...rest} />;
});
