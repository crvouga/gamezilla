import type { ComponentType } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useOnColor } from '../../theme';

export type IconProps = {
  size?: number;
  /** When omitted, inherits on-color context or theme `icon` token. */
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export type IconComponent = ComponentType<IconProps>;

const DEFAULT_SIZE = 24;
const DEFAULT_STROKE_WIDTH = 2;

type LucideIconLike = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

export function createIcon(LucideIcon: LucideIconLike): IconComponent {
  function Icon({
    size = DEFAULT_SIZE,
    color,
    strokeWidth = DEFAULT_STROKE_WIDTH,
    style,
    accessibilityLabel,
    testID,
  }: IconProps) {
    const onColor = useOnColor();
    const resolvedColor = color ?? onColor.icon;
    return (
      <View
        style={[{ alignItems: 'center', justifyContent: 'center' }, style]}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        <LucideIcon
          size={size}
          color={resolvedColor}
          strokeWidth={strokeWidth}
        />
      </View>
    );
  }
  return Icon;
}
