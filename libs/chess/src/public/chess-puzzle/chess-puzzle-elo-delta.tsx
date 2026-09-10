import { useTheme } from '@pkgs/ui';
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
      <h3 class="text textHeading text-text text-center">
        {String(props.displayRating)}
      </h3>
      <p class="text textBodyBold text-center" style={{ color: deltaColor }}>
        {formatSignedDelta(props.delta)}
      </p>
    </>
  );
}
