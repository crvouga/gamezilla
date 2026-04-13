// Fallback: Material Icons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { type ComponentProps, type ReactNode } from 'react';
import {
  ICON_SYMBOL_TO_MATERIAL,
  type IconSymbolName,
} from './mapping';

type MaterialName = ComponentProps<typeof MaterialIcons>['name'];

export type { IconSymbolName };

export type IconSymbolProps = {
  name: IconSymbolName;
  size?: number;
  color: string;
  style?: object;
  weight?: SymbolWeight;
};

/**
 * Native SF Symbols on iOS (`symbol-icon.ios.tsx`); Material Icons elsewhere.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: IconSymbolProps): ReactNode {
  const materialName = ICON_SYMBOL_TO_MATERIAL[name] as MaterialName;
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={materialName}
      style={style}
    />
  );
}
