/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type {
  ColorTone,
  ControlSizeToken,
} from '@pkgs/ui-root-shared-ts/token-names';
import { createMemo, type JSX, Show } from 'solid-js';
import { spaced } from '../layout-classes';
import { toneClass } from '../text-classes';

export type SparklineProps = {
  /** The series, oldest first. */
  values: readonly number[];
  /** Line color. Default `tint`. */
  tone?: ColorTone | undefined;
  /** Height of the plot, on the control-size scale. Default `md`. */
  size?: ControlSizeToken | undefined;
  /** Makes the line an image with this name; unset, it is decorative. */
  'aria-label'?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

/** Plot coordinates: the viewBox stretches to whatever box the line gets. */
const PLOT = { across: 280, down: 48, inset: 1 } as const;

const SIZE: Readonly<Record<ControlSizeToken, string>> = {
  sm: 'h-ui-control-sm',
  md: 'h-ui-control-md',
  lg: 'h-ui-control-lg',
};

/** `x,y x,y …` for a polyline; empty when there is no line to draw. */
export function sparklinePoints(values: readonly number[]): string {
  if (values.length < 2) return '';
  const low = Math.min(...values);
  const range = Math.max(...values) - low || 1;
  const last = values.length - 1;
  const drop = PLOT.down - PLOT.inset * 2;
  return values
    .map((value, index) => {
      const x = (index / last) * PLOT.across;
      const y = PLOT.down - PLOT.inset - ((value - low) / range) * drop;
      return `${x},${y}`;
    })
    .join(' ');
}

/**
 * `Sparkline` -- a series as one line, with no axes or labels: the shape of
 * a rating history, a streak, a trend. The line spans the full width of its
 * parent and the series' own minimum and maximum span the height.
 *
 * Fewer than two points draw nothing. The line is decorative unless it is
 * given an `aria-label`; say the fact it shows (the current rating, the
 * change) in text beside it.
 *
 * @example
 * ```tsx
 * <Sparkline values={ratingHistory()} tone="tint" size="md" />
 * ```
 */
export function Sparkline(props: SparklineProps): JSX.Element {
  const points = createMemo(() => sparklinePoints(props.values));
  const label = (): string | undefined => props['aria-label'];
  return (
    <Show when={points() !== ''}>
      <svg
        class={spaced([
          'box w-full',
          SIZE[props.size ?? 'md'],
          toneClass(props.tone ?? 'tint'),
        ])}
        viewBox={`0 0 ${PLOT.across} ${PLOT.down}`}
        preserveAspectRatio="none"
        role={label() === undefined ? undefined : 'img'}
        aria-label={label()}
        aria-hidden={label() === undefined ? true : undefined}
        data-testid={props.testId}
        data-component={componentId('Sparkline')}
      >
        <polyline
          points={points()}
          fill="none"
          stroke="currentColor"
          stroke-width={2}
          stroke-linejoin="round"
          stroke-linecap="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </Show>
  );
}
