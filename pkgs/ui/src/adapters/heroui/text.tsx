/**
 * HeroUI Native `Text` adapter.
 *
 * The port `Text` is the most-used component in the design system, with a
 * rich variant vocabulary (`body`, `bodyBold`, `caption`, `label`, `title`,
 * `subtitle`, `heading`, `navigationTitle`, `link`, `mono`) and explicit
 * `label` / `sx` props. HeroUI Native's `Text` uses semantic `type`
 * (`h1`-`h6`, `body`, `body-sm`, `body-xs`, `code`), `weight`, and
 * `color` (`'default' | 'muted'`).
 *
 * We map variants to the closest HeroUI primitive and forward the
 * resolved `sx` block through `style` so utility tokens (`p`, `mt`,
 * `color`, ...) keep working. Variants that have no clean HeroUI
 * equivalent (e.g. `mono`, `link`) fall back to `type='body'` with
 * targeted style overrides.
 */

import { Text as HeroUIText } from 'heroui-native';
import { forwardRef } from 'react';
import type { Text as RNText, TextStyle } from 'react-native';
import type { TextProps, TextVariant } from '../../components/text';
import { textCasingToStyle, useTheme } from '../../theme';

type HeroUITextType = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body';
type HeroUITextWeight = 'normal' | 'medium' | 'semibold' | 'bold';

const VARIANT_TYPE: Record<TextVariant, HeroUITextType> = {
  body: 'body',
  bodyBold: 'body',
  caption: 'body',
  label: 'body',
  title: 'h1',
  subtitle: 'h3',
  heading: 'h2',
  navigationTitle: 'h5',
  link: 'body',
  mono: 'body',
};

const VARIANT_WEIGHT: Partial<Record<TextVariant, HeroUITextWeight>> = {
  bodyBold: 'semibold',
  label: 'medium',
  title: 'bold',
  subtitle: 'bold',
  heading: 'bold',
  navigationTitle: 'semibold',
};

const CASING_VARIANTS = new Set<TextVariant>([
  'title',
  'subtitle',
  'heading',
  'navigationTitle',
  'label',
]);

function styleOverridesFor(
  variant: TextVariant,
  theme: ReturnType<typeof useTheme>
): TextStyle | undefined {
  if (variant === 'caption') {
    return { fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary };
  }
  if (variant === 'link') {
    return { color: theme.colors.tint };
  }
  if (variant === 'mono') {
    return { fontFamily: theme.fonts.mono };
  }
  return undefined;
}

export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = 'body', sx: sxProp, style, label, children, ...rest },
  ref
) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const casingStyle = CASING_VARIANTS.has(variant)
    ? textCasingToStyle(theme.textCasing)
    : undefined;
  const overrides = styleOverridesFor(variant, theme);
  const content = label ?? children;
  const weight = VARIANT_WEIGHT[variant];
  const weightProp = weight === undefined ? {} : { weight };
  return (
    <HeroUIText
      ref={ref}
      type={VARIANT_TYPE[variant]}
      {...weightProp}
      style={[overrides, casingStyle, sxStyle, style]}
      {...rest}
    >
      {content}
    </HeroUIText>
  );
});
