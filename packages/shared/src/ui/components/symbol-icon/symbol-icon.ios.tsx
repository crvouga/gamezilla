import { SymbolView, type SymbolViewProps, type SymbolWeight } from 'expo-symbols';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { IconSymbolName } from './mapping';

export type { IconSymbolName };

export type IconSymbolProps = {
  name: IconSymbolName;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: IconSymbolProps): ReactNode {
  return (
    <SymbolView
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={name as SymbolViewProps['name']}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}
