import { AnimatedBox, Box, Text } from '@pkgs/ui';
import { startTiming } from '@pkgs/ui/animation/run-timing';
import { USE_NATIVE_DRIVER } from '@pkgs/ui/animation/use-native-driver';
import { motion } from '@pkgs/ui/theme/motion';
import { type ReactNode, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export type ChessPuzzleEloChipProps = {
  elo: number;
  variant?: 'primary' | 'muted';
  testID?: string;
  pulseNonce?: number;
};

export function ChessPuzzleEloChip({
  elo,
  variant = 'primary',
  testID,
  pulseNonce = 0,
}: ChessPuzzleEloChipProps): ReactNode {
  const isPrimary = variant === 'primary';
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pulseNonce === 0) return;
    scale.setValue(1);
    startTiming(
      scale,
      {
        toValue: 1.14,
        duration: motion.duration.fast,
        useNativeDriver: USE_NATIVE_DRIVER,
      },
      () => {
        startTiming(scale, {
          toValue: 1,
          duration: motion.duration.fast,
          useNativeDriver: USE_NATIVE_DRIVER,
        });
      }
    );
  }, [pulseNonce, scale]);

  return (
    <AnimatedBox sx={{ transform: [{ scale }] }}>
      <Box
        testID={testID}
        sx={{
          px: 2,
          py: 1,
          borderRadius: 6,
          background: isPrimary ? 'tintMuted' : 'surfaceMuted',
        }}
      >
        <Text
          variant={isPrimary ? 'bodyBold' : 'caption'}
          sx={{ color: isPrimary ? 'tint' : 'textSecondary' }}
          label={String(elo)}
        />
      </Box>
    </AnimatedBox>
  );
}
