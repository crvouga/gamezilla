import Svg, { Circle, G, Line, Rect, type SvgProps } from 'react-native-svg';

export type TicTacToeArtworkProps = SvgProps & {
  /** Square icon size in px. Defaults to 96. */
  size?: number;
};

const gameTheme = {
  background: '#14BDAC',
  line: '#0DA192',
  cross: '#545454',
  naught: '#F2EBD3',
} as const;

type Slot = 'X' | 'O' | ' ';

function Naught({
  cx,
  cy,
  r,
  strokeWidth,
  color = gameTheme.naught,
}: {
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  color?: string;
}) {
  return (
    <Circle
      cx={cx}
      cy={cy}
      r={r}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="transparent"
    />
  );
}

function Cross({
  cx,
  cy,
  r,
  strokeWidth,
  color = gameTheme.cross,
}: {
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  color?: string;
}) {
  return (
    <G stroke={color} strokeWidth={strokeWidth}>
      <Line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} />
      <Line x1={cx + r} y1={cy - r} x2={cx - r} y2={cy + r} />
    </G>
  );
}

function ViewSlot({
  slot,
  cx,
  cy,
  r,
  strokeWidth,
}: {
  slot: Slot;
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
}) {
  switch (slot) {
    case 'O':
      return <Naught cx={cx} cy={cy} r={r} strokeWidth={strokeWidth} />;
    case 'X':
      return <Cross cx={cx} cy={cy} r={r} strokeWidth={strokeWidth} />;
    default:
      return null;
  }
}

export function TicTacToeArtwork({
  size = 96,
  ...props
}: TicTacToeArtworkProps) {
  // Direct port of the provided `CoverArt` composition.
  const positions: { column: number; row: number; slot: Slot }[] = [
    { row: 0, column: 0, slot: 'X' },
    { row: 0, column: 1, slot: ' ' },
    { row: 1, column: 0, slot: ' ' },
    { row: 1, column: 1, slot: 'O' },
  ];

  const lines = [
    { x1: 1, y1: 0, x2: 1, y2: 2 },
    { x1: 0, y1: 1, x2: 2, y2: 1 },
  ] as const;

  const strokeWidth = 0.1;

  return (
    <Svg width={size} height={size} viewBox="0 0 2 2" {...props}>
      <Rect x={0} y={0} width={2} height={2} fill={gameTheme.background} />

      {lines.map((l, i) => (
        <Line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={gameTheme.line}
          strokeWidth={strokeWidth}
        />
      ))}

      {positions.map(({ column, row, slot }, i) => (
        <ViewSlot
          key={i}
          slot={slot}
          cx={column + 0.5}
          cy={row + 0.5}
          r={0.3}
          strokeWidth={0.1}
        />
      ))}
    </Svg>
  );
}
