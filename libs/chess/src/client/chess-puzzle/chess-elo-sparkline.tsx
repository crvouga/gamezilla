import { Box, useTheme } from '@pkgs/ui';
import Svg, { Polyline } from '@pkgs/ui/svg';
import { useMemo, type ReactNode } from 'react';

const SPARKLINE_HEIGHT = 48;
const SPARKLINE_WIDTH = 280;

function buildPoints(series: readonly number[]): string {
  if (series.length < 2) return '';
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const lastIdx = series.length - 1;
  return series
    .map((value, idx) => {
      const x = (idx / lastIdx) * SPARKLINE_WIDTH;
      const y =
        SPARKLINE_HEIGHT - ((value - min) / range) * SPARKLINE_HEIGHT;
      return `${x},${y}`;
    })
    .join(' ');
}

export type ChessEloSparklineProps = {
  series: readonly number[];
  testID?: string;
};

export function ChessEloSparkline({
  series,
  testID,
}: ChessEloSparklineProps): ReactNode {
  const theme = useTheme();
  const points = useMemo(() => buildPoints(series), [series]);
  if (points.length === 0) return null;

  return (
    <Box testID={testID} sx={{ alignSelf: 'stretch', alignItems: 'center' }}>
      <Svg width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT}>
        <Polyline
          points={points}
          fill="none"
          stroke={theme.colors.tint}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </Box>
  );
}
