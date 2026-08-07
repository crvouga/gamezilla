import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  type LayoutRectangle,
  Platform,
  View,
} from 'react-native';

import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { duration } from '../../theme/motion';
import { borderRadius } from '../../theme/scale';
import { Text } from '../text';
import {
  resolveTooltipPosition,
  TOOLTIP_MAX_WIDTH,
  type TooltipBubbleSize,
  type TooltipPlacement,
} from './tooltip-layout';
import { useViewportSize } from './tooltip-viewport';

const ENTER_DURATION_MS = duration.fast;
const ENTER_OFFSET = 4;

function useTooltipEnterAnim(
  active: boolean,
  enterKey: number
): Animated.Value {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      progress.setValue(0);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: ENTER_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [active, enterKey, progress]);
  return progress;
}

function bubbleMotionStyle(
  placement: TooltipPlacement,
  progress: Animated.Value
): {
  opacity: Animated.Value;
  transform: Array<{ translateY: Animated.AnimatedInterpolation<number> }>;
} {
  const offset =
    placement === 'top'
      ? progress.interpolate({
          inputRange: [0, 1],
          outputRange: [ENTER_OFFSET, 0],
        })
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-ENTER_OFFSET, 0],
        });
  return {
    opacity: progress,
    transform: [{ translateY: offset }],
  };
}

function fixedPositionStyle(top: number, left: number): View['props']['style'] {
  if (Platform.OS === 'web') {
    return {
      position: 'fixed',
      top,
      left,
      zIndex: 1_000_001,
    } as unknown as View['props']['style'];
  }
  return {
    position: 'absolute',
    top,
    left,
    zIndex: 1_000_001,
  };
}

export function TooltipBubble({
  label,
  anchor,
  preferredPlacement,
  enterKey,
  dataSet,
}: {
  label: ReactNode;
  anchor: LayoutRectangle;
  preferredPlacement: TooltipPlacement;
  enterKey: number;
  dataSet?: ComponentDataSet;
}): ReactNode {
  const theme = useTheme();
  const viewport = useViewportSize();
  const [bubbleSize, setBubbleSize] = useState<TooltipBubbleSize | null>(null);
  const position =
    bubbleSize === null
      ? null
      : resolveTooltipPosition(
          anchor,
          bubbleSize,
          viewport,
          preferredPlacement
        );
  const progress = useTooltipEnterAnim(position !== null, enterKey);
  const motion =
    position === null ? null : bubbleMotionStyle(position.placement, progress);

  const handleLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setBubbleSize((current) => {
      if (current?.width === width && current.height === height) return current;
      return { width, height };
    });
  };

  const shellStyle =
    position === null
      ? fixedPositionStyle(anchor.y, anchor.x)
      : fixedPositionStyle(position.top, position.left);

  return (
    <Animated.View
      pointerEvents="none"
      style={[shellStyle, motion === null ? { opacity: 0 } : motion]}
    >
      <View
        {...componentDataSet('Tooltip', dataSet)}
        onLayout={handleLayout}
        style={{
          backgroundColor: theme.colors.surfaceElevated,
          borderRadius: borderRadius.sm,
          paddingHorizontal: 8,
          paddingVertical: 4,
          maxWidth: TOOLTIP_MAX_WIDTH,
          alignSelf: 'flex-start',
          ...(theme.elevation(3).boxShadow
            ? { boxShadow: theme.elevation(3).boxShadow }
            : {}),
        }}
      >
        <Text
          variant="caption"
          label={label}
          numberOfLines={2}
          sx={{ color: 'text', textAlign: 'center' }}
        />
      </View>
    </Animated.View>
  );
}
