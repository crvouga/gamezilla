import { useTheme } from '@pkgs/ui-root-client/theme-context';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
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

export type PuzzleRatingSparklineProps = {
  series: readonly number[];
  testID?: string;
};

export function PuzzleRatingSparkline(
  props: PuzzleRatingSparklineProps
): JSX.Element {
  const theme = useTheme();
  const points = createMemo(() => buildPoints(props.series));

  return (
    <Show when={points().length > 0}>
      <div
        class="box self-stretch items-center w-full max-w-70"
        {...dataAttrs(
          props.testID !== undefined ? { testid: props.testID } : undefined
        )}
      >
        <svg
          viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
          width="100%"
          height={SPARKLINE_HEIGHT}
          preserveAspectRatio="none"
        >
          <polyline
            points={points()}
            fill="none"
            stroke={theme.palette().tint}
            stroke-width={2}
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>
      </div>
    </Show>
  );
}
