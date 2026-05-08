/* eslint-disable lingui/no-unlocalized-strings */

import Svg, { G, Path, Rect, type SvgProps } from 'react-native-svg';

export type ChessArtworkProps = SvgProps & {
  /** Square icon size in px. Defaults to 96. */
  size?: number;
};

const theme = {
  lightSquare: '#7C6141',
  darkSquare: '#533F30',
  pawn: '#93BA46',
} as const;

/**
 * Port of the provided cover art: 2×2 board + pawn.
 * Implemented with `react-native-svg`.
 */
export function ChessArtwork({ size = 96, ...props }: ChessArtworkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 2 2" {...props}>
      <Rect x={0} y={0} width={1} height={1} fill={theme.lightSquare} />
      <Rect x={0} y={1} width={1} height={1} fill={theme.darkSquare} />
      <Rect x={1} y={1} width={1} height={1} fill={theme.lightSquare} />
      <Rect x={1} y={0} width={1} height={1} fill={theme.darkSquare} />

      <Svg x={0} y={0} width={2} height={2} viewBox="0 0 45 45">
        <G transform="translate(0 -2)">
          <Path
            fill={theme.pawn}
            stroke={theme.pawn}
            strokeLinecap="round"
            strokeWidth={1.5}
            d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
          />
        </G>
      </Svg>
    </Svg>
  );
}
