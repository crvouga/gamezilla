import { Text, useTheme } from '@pkgs/ui';
import type { JSX } from 'solid-js';

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

export function ChessPuzzleEloDelta(
  props: ChessPuzzleEloDeltaProps
): JSX.Element {
  const theme = useTheme();

  const deltaColor =
    props.delta > 0
      ? theme.colors.success
      : props.delta < 0
        ? theme.colors.destructive
        : theme.colors.textSecondary;

  return (
    <>
      <Text
        variant="heading"
        sx={{ color: 'text', textAlign: 'center' }}
        label={String(props.displayRating)}
      />
      <Text
        variant="bodyBold"
        sx={{ color: deltaColor, textAlign: 'center' }}
        label={formatSignedDelta(props.delta)}
      />
    </>
  );
}
