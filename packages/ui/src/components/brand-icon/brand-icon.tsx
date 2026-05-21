/**
 * `BrandIcon` -- third-party brand logo primitive (Google, etc.).
 *
 * Companion to {@link import('../symbol-icon').IconSymbol IconSymbol}. The
 * key difference: brand icons use the vendor's published colors and do not
 * accept a `color` prop, so they cannot be retinted by the theme.
 *
 * @example
 * ```tsx
 * <BrandIcon name="google" size={20} />
 * ```
 */
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { assert } from '@gamezilla/assert';
import { BRAND_ICON_REGISTRY, type BrandIconName } from './brand-icon-registry';

export type { BrandIconName };

export type BrandIconProps = {
  name: BrandIconName;
  /** Square size in pixels. Defaults to 20. */
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function BrandIcon({ name, size = 20, style }: BrandIconProps) {
  const Logo = BRAND_ICON_REGISTRY[name];
  assert.defined(Logo, `BrandIcon: unknown name "${String(name)}"`);
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <Logo size={size} />
    </View>
  );
}
