import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  type LayoutRectangle,
  Platform,
} from 'react-native';

import { startTiming } from '../../animation/run-timing';
import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import type { ComponentDataSet } from '../../component-id';
import type { SxProps } from '../../theme';
import { useTheme } from '../../theme';
import { duration } from '../../theme/motion';
import { borderRadius } from '../../theme/scale';
import { AnimatedBox } from '../animated-box';
import { Box } from '../box';
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
    const animation = startTiming(progress, {
      toValue: 1,
      duration: ENTER_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    return () => {
      animation.stop();
    };
  }, [active, enterKey, progress]);
  return progress;
}

function bubbleMotionSx(
  placement: TooltipPlacement,
  progress: Animated.Value
): SxProps {
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

function fixedPositionSx(top: number, left: number): SxProps {
  return {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
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
    position === null ? null : bubbleMotionSx(position.placement, progress);

  const handleLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setBubbleSize((current) => {
      if (current?.width === width && current.height === height) return current;
      return { width, height };
    });
  };

  const shellSx =
    position === null
      ? fixedPositionSx(anchor.y, anchor.x)
      : fixedPositionSx(position.top, position.left);
  const lift = theme.elevation(3);

  return (
    <AnimatedBox
      pointerEvents="none"
      sx={[shellSx, motion === null ? { opacity: 0 } : motion]}
    >
      <Box
        dataSet={{ component: 'Tooltip', ...dataSet }}
        onLayout={handleLayout}
        sx={{
          backgroundColor: 'surfaceElevated',
          borderRadius: borderRadius.sm,
          paddingHorizontal: 8,
          paddingVertical: 4,
          maxWidth: TOOLTIP_MAX_WIDTH,
          alignSelf: 'flex-start',
          elevation: 3,
          ...(lift.boxShadow ? { boxShadow: lift.boxShadow } : {}),
        }}
      >
        <Text
          variant="caption"
          label={label}
          numberOfLines={2}
          sx={{ color: 'text', textAlign: 'center' }}
        />
      </Box>
    </AnimatedBox>
  );
}
