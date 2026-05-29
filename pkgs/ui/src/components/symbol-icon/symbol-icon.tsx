/**
 * Themed icon primitive: Font Awesome 7.x SVGs via `react-native-svg` (see ATTRIBUTION.md).
 */

import { View } from 'react-native';

import { assert } from '@pkgs/assert';
import { useOnColor } from '../../theme';
import { ICON_REGISTRY, type IconSymbolName } from './icon-registry';

export type { IconSymbolName };

export type IconSymbolProps = {
  name: IconSymbolName;
  size?: number;
  /**
   * Icon color. When omitted it inherits the surrounding on-color context
   * (contrast-safe on colored surfaces, `icon` token otherwise).
   */
  color?: string;
  style?: object;
};

export function IconSymbol({ name, size = 24, color, style }: IconSymbolProps) {
  const Icon = ICON_REGISTRY[name];
  const onColor = useOnColor();
  assert.defined(Icon, `IconSymbol: unknown name "${String(name)}"`);
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon size={size} color={color ?? onColor.icon} />
    </View>
  );
}
