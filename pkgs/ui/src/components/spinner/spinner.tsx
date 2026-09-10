/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/**
 * `Spinner` -- themed loading indicator.
 *
 * Draws a partial SVG arc over a faded track ring and rotates it with a CSS
 * keyframe animation (compositor only). Under `prefers-reduced-motion` the
 * rotation becomes a gentle opacity pulse. Exposes `role="status"` so
 * assistive tech announces the busy state.
 *
 * Mount under a {@link SpinnerProvider} to keep the rotation phase continuous
 * when sibling loading states swap.
 *
 * @example
 * ```tsx
 * <Spinner size="small" />
 * <Spinner size={32} color="destructive" />
 * ```
 */

import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { resolveColor, useThemeTokens } from '../../theme';
import styles from './spinner.module.css';
import { useSharedSpinnerDelay } from './spinner-context';

export type SpinnerSize = 'small' | 'medium' | 'large' | number;

export type SpinnerProps = {
  /** Color token name or raw color. Defaults to `"tint"`. */
  color?: string | undefined;
  /** Diameter in pixels, or one of the size presets. Defaults to `"medium"`. */
  size?: SpinnerSize | undefined;
  /** Stroke width in pixels. Derived from `size` if omitted. */
  strokeWidth?: number | undefined;
  /** Accessible name. Defaults to a localized "Loading…". */
  label?: string | undefined;
  /**
   * Hide from assistive tech. Use inside controls that already announce
   * busy-ness (`aria-busy` buttons) so the spinner does not pollute the name.
   */
  decorative?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const SIZE_PRESETS = {
  small: 24,
  medium: 36,
  large: 48,
} as const satisfies Record<'small' | 'medium' | 'large', number>;

/** Visible arc covers 25% of the circle perimeter. */
const ARC_FRACTION = 0.25;
/** Faded base ring rendered behind the moving arc. */
const TRACK_OPACITY = 0.25;

export function resolveSpinnerSize(size: SpinnerSize): number {
  return typeof size === 'number' ? size : SIZE_PRESETS[size];
}

type ArcGeometry = {
  diameter: number;
  strokeWidth: number;
  radius: number;
  dash: number;
  gap: number;
};

function arcGeometry(
  size: SpinnerSize,
  strokeWidth: number | undefined
): ArcGeometry {
  const diameter = resolveSpinnerSize(size);
  const sw = strokeWidth ?? Math.max(2, Math.round(diameter * 0.1));
  const radius = (diameter - sw) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ARC_FRACTION;
  return { diameter, strokeWidth: sw, radius, dash, gap: circumference - dash };
}

export function Spinner(props: SpinnerProps): JSX.Element {
  const tokens = useThemeTokens();
  const { t } = useLingui();
  const delay = useSharedSpinnerDelay();
  const geo = (): ArcGeometry =>
    arcGeometry(props.size ?? 'medium', props.strokeWidth);
  const stroke = (): string =>
    resolveColor(props.color ?? 'tint', tokens.colors) ?? tokens.colors.tint;
  return (
    <div
      class={styles['spin']}
      {...dataAttrs({ component: 'Spinner', ...props.dataSet })}
      style={{
        color: stroke(),
        ...(delay !== undefined ? { 'animation-delay': delay } : {}),
        width: cssPx(geo().diameter),
        height: cssPx(geo().diameter),
      }}
      role={props.decorative === true ? undefined : 'status'}
      aria-label={
        props.decorative === true ? undefined : (props.label ?? t`Loading…`)
      }
      aria-live={props.decorative === true ? undefined : 'polite'}
      aria-hidden={props.decorative === true ? true : undefined}
    >
      <svg
        width={geo().diameter}
        height={geo().diameter}
        viewBox={`0 0 ${geo().diameter} ${geo().diameter}`}
        aria-hidden="true"
      >
        <circle
          cx={geo().diameter / 2}
          cy={geo().diameter / 2}
          r={geo().radius}
          stroke="currentColor"
          stroke-width={geo().strokeWidth}
          fill="none"
          opacity={TRACK_OPACITY}
        />
        <circle
          cx={geo().diameter / 2}
          cy={geo().diameter / 2}
          r={geo().radius}
          stroke="currentColor"
          stroke-width={geo().strokeWidth}
          stroke-linecap="round"
          stroke-dasharray={`${geo().dash} ${geo().gap}`}
          fill="none"
        />
      </svg>
    </div>
  );
}
