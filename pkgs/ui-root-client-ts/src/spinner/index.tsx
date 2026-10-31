/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import {
  ACTIVITY_PETAL_SHAPES,
  ACTIVITY_VIEWBOX,
  petalTransform,
} from '@pkgs/ui-root-shared-ts/activity-indicator';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { ColorTone } from '@pkgs/ui-root-shared-ts/token-names';
import { For, type JSX } from 'solid-js';
import { spaced } from '../layout-classes';
import { useSharedSpinnerDelay } from '../spinner-context/index';
import { toneClass } from '../text-classes';
import styles from './spinner.module.css';

export type SpinnerSize = 'sm' | 'md' | 'lg';

/** A text tone, or `current` for the surrounding text color. */
export type SpinnerColor = Exclude<ColorTone, 'inherit'> | 'current';

export type SpinnerProps = {
  /** Default `md` (24px). */
  size?: SpinnerSize | undefined;
  /** Default `secondary`. */
  color?: SpinnerColor | undefined;
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

const SIZE: Readonly<Record<SpinnerSize, string>> = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-10',
};

/** Pixel edge of each size, for hosts that reserve the same box. */
export const SPINNER_PX: Readonly<Record<SpinnerSize, number>> = {
  sm: 16,
  md: 24,
  lg: 40,
};

function colorClass(color: SpinnerColor): string {
  return color === 'current' ? '' : toneClass(color);
}

/**
 * `Spinner` -- the one activity indicator: twelve rounded petals radiating
 * from the center, the opacity stepping around the ring once a second in
 * twelve discrete steps (UIActivityIndicatorView). Every loading indicator in
 * the product is this component: `Button`'s loading face, `LoadingState`,
 * the FAB, the boot screens (which embed the same markup statically).
 *
 * - `size`: `sm` (16), `md` (24, default), `lg` (40).
 * - `color`: a text tone; defaults to `secondary`. `current` takes the
 *   surrounding text color (inside a filled button).
 * - `label`: the accessible name ("Loading…" when unset). `decorative`
 *   hides it from assistive tech where the host already says it is busy.
 *
 * Under `prefers-reduced-motion` the ring holds still. Mount under a
 * {@link SpinnerProvider} to keep the phase continuous when sibling loading
 * states swap.
 *
 * @example
 * ```tsx
 * <Spinner />
 * <Spinner size="lg" label={t`Loading puzzles`} />
 * <Spinner size="sm" color="current" decorative />
 * ```
 */
export function Spinner(props: SpinnerProps): JSX.Element {
  const { t } = useLingui();
  const delay = useSharedSpinnerDelay();
  return (
    <span
      class={spaced([
        'box items-center justify-center',
        SIZE[props.size ?? 'md'],
        colorClass(props.color ?? 'secondary'),
      ])}
      {...dataAttrs({
        component: 'Spinner',
        size: props.size ?? 'md',
        ...props.dataSet,
      })}
      role={props.decorative === true ? undefined : 'status'}
      aria-label={
        props.decorative === true ? undefined : (props.label ?? t`Loading…`)
      }
      aria-live={props.decorative === true ? undefined : 'polite'}
      aria-hidden={props.decorative === true ? true : undefined}
    >
      <svg
        class={`${styles['petals']} size-full`}
        viewBox={ACTIVITY_VIEWBOX}
        fill="currentColor"
        aria-hidden="true"
        style={delay === undefined ? undefined : { 'animation-delay': delay }}
      >
        <For each={ACTIVITY_PETAL_SHAPES}>
          {(petal) => (
            <rect
              x={petal.x}
              y={petal.y}
              width={petal.width}
              height={petal.height}
              rx={petal.radius}
              transform={petalTransform(petal)}
              opacity={petal.opacity}
            />
          )}
        </For>
      </svg>
    </span>
  );
}
