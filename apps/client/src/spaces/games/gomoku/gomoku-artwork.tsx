/* eslint-disable lingui/no-unlocalized-strings */
/* eslint-disable max-lines-per-function */

import Svg, { Circle, G, Line, Rect, type SvgProps } from 'react-native-svg';

export type GomokuArtworkProps = SvgProps & {
  /** Square icon size in px. Defaults to 96. */
  size?: number;
};

type Stone = 'black' | 'white';
type Position = { x: number; y: number };
type Bounds = { lower: Position; upper: Position };
type Board = Record<number, Record<number, Stone>>;

const backgroundColor = '#C88655';
const lineColor = darkenHex(backgroundColor, 0.3);
const gameTheme = {
  whiteStone: 'white',
  blackStone: 'black',
  background: backgroundColor,
  line: lineColor,
} as const;

function stoneToColor(stone: Stone): string {
  switch (stone) {
    case 'black':
      return gameTheme.blackStone;
    case 'white':
      return gameTheme.whiteStone;
  }
}

function range(lower: number, upper: number): number[] {
  const out: number[] = [];
  for (let n = lower; n < upper; n += 1) out.push(n);
  return out;
}

function allPositionsWithin(bounds: Bounds): Position[] {
  const out: Position[] = [];
  for (let x = bounds.lower.x; x < bounds.upper.x; x += 1) {
    for (let y = bounds.lower.y; y < bounds.upper.y; y += 1) out.push({ x, y });
  }
  return out;
}

function darkenHex(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const hexPart = m?.[1];
  if (!hexPart) return hex;
  const n = parseInt(hexPart, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const f = Math.max(0, Math.min(1, 1 - amount));
  const rr = Math.round(r * f);
  const gg = Math.round(g * f);
  const bb = Math.round(b * f);
  return `#${((1 << 24) | (rr << 16) | (gg << 8) | bb).toString(16).slice(1)}`;
}

function GomokuCoverArtSvg(props: SvgProps) {
  const bounds: Bounds = {
    lower: { x: 0, y: 0 },
    upper: { x: 6, y: 6 },
  };
  const viewBoxOffset = 0.5;

  const boundsView: Bounds = {
    lower: {
      x: bounds.lower.x - viewBoxOffset,
      y: bounds.lower.y - viewBoxOffset,
    },
    upper: {
      x: bounds.upper.x - 1 + viewBoxOffset,
      y: bounds.upper.y - 1 + viewBoxOffset,
    },
  };

  const width = boundsView.upper.x - boundsView.lower.x;
  const height = boundsView.upper.y - boundsView.lower.y;
  const viewBox = `${boundsView.lower.x} ${boundsView.lower.y} ${width} ${height}`;

  const board: Board = {
    2: { 2: 'black', 3: 'white' },
    3: { 2: 'black', 3: 'white' },
    4: { 2: 'white', 3: 'black' },
  };

  const positions = allPositionsWithin(bounds);

  // In the original, stars came from presetToStars['9x9'].
  // For this 6x6 view, a single central star keeps the cover art clean.
  const stars: Position[] = [{ x: 3, y: 3 }];

  return (
    <Svg viewBox={viewBox} {...props}>
      <G strokeWidth={0.05}>
        <Rect
          x={boundsView.lower.x}
          y={boundsView.lower.y}
          width={width}
          height={height}
          fill={gameTheme.background}
        />

        <G stroke={gameTheme.line}>
          <Rect
            x={bounds.lower.x}
            y={bounds.lower.y}
            width={bounds.upper.x - 1 - bounds.lower.x}
            height={bounds.upper.y - 1 - bounds.lower.y}
            fill={gameTheme.background}
          />

          {range(1, bounds.upper.y).map((x) => (
            <Line
              key={`x${x}`}
              x1={x}
              y1={bounds.lower.y}
              x2={x}
              y2={bounds.upper.y - 1}
            />
          ))}

          {range(1, bounds.upper.x).map((y) => (
            <Line
              key={`y${y}`}
              x1={bounds.lower.x}
              y1={y}
              x2={bounds.upper.x - 1}
              y2={y}
            />
          ))}
        </G>

        <G>
          {stars.map((pos) => (
            <Circle
              key={`${pos.x},${pos.y}`}
              cx={pos.x}
              cy={pos.y}
              r={0.12}
              fill={gameTheme.line}
            />
          ))}
        </G>

        {positions.flatMap(({ x, y }) => {
          const stone = board[x]?.[y] ?? null;
          if (!stone) return [];
          return (
            <Circle
              key={`${x}-${y}-${stone}`}
              cx={x}
              cy={y}
              r={0.45}
              fill={stoneToColor(stone)}
            />
          );
        })}
      </G>
    </Svg>
  );
}

export function GomokuArtwork({ size = 96, ...props }: GomokuArtworkProps) {
  return <GomokuCoverArtSvg width={size} height={size} {...props} />;
}
