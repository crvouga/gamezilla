import { Text, useTheme } from '@pkgs/ui';
import { USE_NATIVE_DRIVER } from '@pkgs/ui/animation/use-native-driver';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated } from 'react-native';

const COUNT_UP_MS = 800;

function formatSignedDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export type ChessPuzzleEloDeltaProps = {
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
};

export function ChessPuzzleEloDelta({
  ratingBefore,
  ratingAfter,
  delta,
}: ChessPuzzleEloDeltaProps): ReactNode {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [displayRating, setDisplayRating] = useState(ratingBefore);

  useEffect(() => {
    progress.setValue(0);
    setDisplayRating(ratingBefore);
    const listenerId = progress.addListener(({ value }) => {
      const next = Math.round(
        ratingBefore + (ratingAfter - ratingBefore) * value
      );
      setDisplayRating(next);
    });
    Animated.timing(progress, {
      toValue: 1,
      duration: COUNT_UP_MS,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    return () => {
      progress.removeListener(listenerId);
    };
  }, [progress, ratingAfter, ratingBefore]);

  const deltaColor =
    delta > 0
      ? theme.colors.success
      : delta < 0
        ? theme.colors.destructive
        : theme.colors.textSecondary;

  return (
    <>
      <Text
        variant="heading"
        style={{ color: theme.colors.text, textAlign: 'center' }}
        label={String(displayRating)}
      />
      <Text
        variant="bodyBold"
        style={{ color: deltaColor, textAlign: 'center' }}
        label={formatSignedDelta(delta)}
      />
    </>
  );
}
