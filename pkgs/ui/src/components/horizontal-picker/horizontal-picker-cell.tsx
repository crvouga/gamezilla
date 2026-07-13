import type { ReactNode } from 'react';
import { Pressable, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

const UNSELECTED_SCALE = 0.85;
const UNSELECTED_OPACITY = 0.5;

export type HorizontalPickerCellProps = {
  index: number;
  itemWidth: number;
  scrollX: SharedValue<number>;
  onPress: () => void;
  children: ReactNode;
};

export function HorizontalPickerCell({
  index,
  itemWidth,
  scrollX,
  onPress,
  children,
}: HorizontalPickerCellProps): ReactNode {
  const animatedStyle = useAnimatedStyle(() => {
    const center = index * itemWidth;
    const input = [center - itemWidth, center, center + itemWidth];
    return {
      transform: [
        {
          scale: interpolate(
            scrollX.value,
            input,
            [UNSELECTED_SCALE, 1, UNSELECTED_SCALE],
            Extrapolation.CLAMP
          ),
        },
      ],
      opacity: interpolate(
        scrollX.value,
        input,
        [UNSELECTED_OPACITY, 1, UNSELECTED_OPACITY],
        Extrapolation.CLAMP
      ),
    };
  });

  const cellStyle: ViewStyle = {
    width: itemWidth,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <Pressable onPress={onPress} style={cellStyle}>
      <Animated.View style={[cellStyle, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
