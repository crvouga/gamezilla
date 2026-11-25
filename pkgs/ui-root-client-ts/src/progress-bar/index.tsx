/** @jsxImportSource @solidjs/web */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Progress, ProgressIndicator } from '@ui-sdk/solid/progress';
import { Show } from 'solid-js';
import { spaced } from '../layout-classes';
import styles from './progress-bar.module.css';

/** Fill color: `tint` for work in progress, or a finished outcome. */
export type ProgressBarTone = 'tint' | 'success' | 'destructive';

/** Track height: `sm` (4px) inside chrome, `md` (8px, default) on its own. */
export type ProgressBarSize = 'sm' | 'md';

export type ProgressBarProps = {
  /** Fraction completed, 0..1. Omit when the total is not known. */
  progress?: number | undefined;
  /** Accessible name; when set it is shown with the percentage. */
  label?: string | undefined;
  /**
   * Accessible name for a bare track whose words sit beside it (`7 of 12
   * rated games`): names the bar without drawing a label.
   */
  accessibleLabel?: string | undefined;
  /** Supporting copy under a labelled bar. */
  description?: JSX.Element | undefined;
  /** Default `tint`. */
  tone?: ProgressBarTone | undefined;
  /** Default `md`. */
  size?: ProgressBarSize | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const TONE: Readonly<Record<ProgressBarTone, string>> = {
  tint: 'bg-tint',
  success: 'bg-success',
  destructive: 'bg-destructive',
};

const SIZE: Readonly<Record<ProgressBarSize, string>> = {
  sm: 'h-1',
  md: 'h-2',
};

function clamp01(v: number): number {
  return Number.isNaN(v) ? 0 : Math.min(Math.max(v, 0), 1);
}

/**
 * The track is the line tone (`border`), a step off a raised card in both
 * themes: the sunken well vanished on a dark card.
 */
function ProgressTrack(props: {
  known: boolean;
  value: number;
  label: string | undefined;
  tone: ProgressBarTone;
  size: ProgressBarSize;
}): JSX.Element {
  return (
    <Progress
      class={`box w-full overflow-hidden rounded-full bg-border ${SIZE[props.size]}`}
      value={props.known ? props.value : null}
      min={0}
      max={1}
      aria-label={props.label}
      aria-busy={props.known ? undefined : 'true'}
    >
      <ProgressIndicator
        class={spaced([
          'box h-full rounded-full',
          TONE[props.tone],
          props.known ? styles['fill'] : styles['sweep'],
        ])}
      />
    </Progress>
  );
}

/**
 * `ProgressBar` -- the one progress indicator. Pass a fraction from zero to
 * one, or omit `progress` while the amount of work is unknown: the bar then
 * sweeps a partial fill (held still under `prefers-reduced-motion`) and
 * claims no value.
 *
 * With a `label` the bar is named, shows the percentage beside the label and
 * an optional `description` below it. Without one it is the bare track.
 * Exposes `role="progressbar"` with `aria-valuenow` (omitted while
 * indeterminate, per WAI-ARIA). Announce completion only after the operation
 * succeeds.
 *
 * @example
 * ```tsx
 * <ProgressBar label={t`Uploading file`} progress={0.6} />
 * <ProgressBar size="sm" />
 * ```
 */
export function ProgressBar(props: ProgressBarProps): JSX.Element {
  const { t } = useLingui();
  const known = (): boolean => props.progress !== undefined;
  const value = (): number => clamp01(props.progress ?? 0);
  return (
    <div
      class="box w-full min-w-0 gap-2"
      {...dataAttrs({ component: 'ProgressBar', ...props.dataSet })}
    >
      <Show when={props.label}>
        {(label) => (
          <div class="box flex-row items-baseline justify-between gap-3">
            <span class="text textLabel">{label()}</span>
            <Show when={known()}>
              <span class="text textCaption textNumeral">
                {Math.floor(value() * 100)}%
              </span>
            </Show>
          </div>
        )}
      </Show>
      <ProgressTrack
        known={known()}
        value={value()}
        label={props.label ?? props.accessibleLabel ?? t`Progress`}
        tone={props.tone ?? 'tint'}
        size={props.size ?? 'md'}
      />
      <Show when={props.label !== undefined && props.description}>
        <div class="text textCaption">{props.description}</div>
      </Show>
    </div>
  );
}
