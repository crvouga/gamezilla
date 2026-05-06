/* eslint-disable lingui/no-unlocalized-strings */

import * as React from 'react';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Mask,
  Pattern,
  Rect,
  Stop,
  type SvgProps,
} from 'react-native-svg';

export type ConnectFourArtworkProps = SvgProps & {
  /** Square icon size in px. Defaults to 96. */
  size?: number;
};

// Local port defaults (the source version imported these).
const COLUMN_COUNT = 2;
const MAX_COLUMN_HEIGHT = 2;

const gameTheme = {
  primary: {
    light: '#2FA7FF',
    dark: '#0B58E6',
    darker: '#08308F',
  },
  'player-one': {
    light: '#FFD34D',
    dark: '#FF9F1A',
  },
  'player-two': {
    light: '#FF6B8A',
    dark: '#E11D48',
  },
} as const;

function useStableIds(prefix: string) {
  const seed = React.useMemo(() => Math.random().toString(36).slice(2), []);
  return React.useMemo(
    () => ({
      playerOneGradient: `${prefix}_playerOneGradient_${seed}`,
      playerTwoGradient: `${prefix}_playerTwoGradient_${seed}`,
      holePattern: `${prefix}_holePattern_${seed}`,
      columnGradient: `${prefix}_columnGradient_${seed}`,
      holeMask: `${prefix}_holeMask_${seed}`,
    }),
    [prefix, seed]
  );
}

export function ConnectFourArtwork({
  size = 96,
  ...props
}: ConnectFourArtworkProps) {
  const ids = useStableIds('gz_connect_four_cover');
  const playerOneFill = `url(#${ids.playerOneGradient})`;
  const playerTwoFill = `url(#${ids.playerTwoGradient})`;

  return (
    <Svg width={size} height={size} viewBox="0 0 2 2" {...props}>
      <Defs>
        <Pattern
          id={ids.holePattern}
          patternUnits="userSpaceOnUse"
          width={1}
          height={1}
        >
          <Circle cx={0.5} cy={0.5} r={0.425} fill="black" />
        </Pattern>

        <Mask id={ids.holeMask} maskUnits="userSpaceOnUse">
          <Rect
            x={0}
            y={0}
            width={COLUMN_COUNT}
            height={MAX_COLUMN_HEIGHT}
            fill="white"
          />
          <Rect
            x={0}
            y={0}
            width={COLUMN_COUNT}
            height={MAX_COLUMN_HEIGHT}
            fill={`url(#${ids.holePattern})`}
          />
        </Mask>

        <LinearGradient id={ids.columnGradient} gradientTransform="rotate(90)">
          <Stop offset="0%" stopColor={gameTheme.primary.light} />
          <Stop offset="100%" stopColor={gameTheme.primary.dark} />
        </LinearGradient>

        <LinearGradient
          id={ids.playerOneGradient}
          gradientTransform="rotate(90)"
        >
          <Stop offset="0%" stopColor={gameTheme['player-one'].light} />
          <Stop offset="100%" stopColor={gameTheme['player-one'].dark} />
        </LinearGradient>

        <LinearGradient
          id={ids.playerTwoGradient}
          gradientTransform="rotate(90)"
        >
          <Stop offset="0%" stopColor={gameTheme['player-two'].light} />
          <Stop offset="100%" stopColor={gameTheme['player-two'].dark} />
        </LinearGradient>
      </Defs>

      <Rect x={0} y={0} width={2} height={2} fill={gameTheme.primary.darker} />

      <Circle cx={0.5} cy={0} r={0.5} fill={playerOneFill} />
      <Circle cx={1.5} cy={0.5} r={0.5} fill={playerTwoFill} />
      <Circle cx={1.5} cy={1.5} r={0.5} fill={playerOneFill} />
      <Circle cx={0.5} cy={1.5} r={0.5} fill={playerTwoFill} />

      <Rect
        x={0}
        y={0}
        width={COLUMN_COUNT}
        height={MAX_COLUMN_HEIGHT}
        fill={`url(#${ids.columnGradient})`}
        mask={`url(#${ids.holeMask})`}
      />
    </Svg>
  );
}
