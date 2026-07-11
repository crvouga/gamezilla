import { Text, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { Animated } from 'react-native';

function formatSignedDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export type ChessPuzzleEloDeltaProps = {
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  displayRating: number;
};

export function ChessPuzzleEloDelta({
  delta,
  displayRating,
}: ChessPuzzleEloDeltaProps): ReactNode {
  const theme = useTheme();

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
      <Animated.View>
        <Text
          variant="bodyBold"
          style={{ color: deltaColor, textAlign: 'center' }}
          label={formatSignedDelta(delta)}
        />
      </Animated.View>
    </>
  );
}
