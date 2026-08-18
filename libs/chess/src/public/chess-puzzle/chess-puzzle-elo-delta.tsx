import { Text, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';

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
        sx={{ color: 'text', textAlign: 'center' }}
        label={String(displayRating)}
      />
      <Text
        variant="bodyBold"
        sx={{ color: deltaColor, textAlign: 'center' }}
        label={formatSignedDelta(delta)}
      />
    </>
  );
}
