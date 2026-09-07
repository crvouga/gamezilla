import { Box, useTheme } from '@pkgs/ui';
import { createMemo, type JSX, Show } from 'solid-js';

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
      const y = SPARKLINE_HEIGHT - ((value - min) / range) * SPARKLINE_HEIGHT;
      return `${x},${y}`;
    })
    .join(' ');
}

export type ChessEloSparklineProps = {
  series: readonly number[];
  testID?: string;
};

export function ChessEloSparkline(props: ChessEloSparklineProps): JSX.Element {
  const theme = useTheme();
  const points = createMemo(() => buildPoints(props.series));

  return (
    <Show when={points().length > 0}>
      <Box
        dataSet={
          props.testID !== undefined ? { testid: props.testID } : undefined
        }
        sx={{ alignSelf: 'stretch', alignItems: 'center' }}
      >
        <svg width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT}>
          <polyline
            points={points()}
            fill="none"
            stroke={theme.palette().tint}
            stroke-width={2}
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>
      </Box>
    </Show>
  );
}
