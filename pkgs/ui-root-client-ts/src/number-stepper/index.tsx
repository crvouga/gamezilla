/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX, Show } from 'solid-js';

export type NumberStepperProps = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number | undefined;
  disabled?: boolean | undefined;
  /** Id of a line that explains the value (its range, why it is not allowed). */
  'aria-describedby'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** Pure clamp-and-step used by the buttons and arrow keys. */
export function stepValue(
  value: number,
  delta: number,
  min: number,
  max: number
): number {
  return Math.min(max, Math.max(min, value + delta));
}

/** Which bound the value sits on, if any (pure). */
export function stepperBound(
  value: number,
  min: number,
  max: number
): 'min' | 'max' | null {
  if (value <= min) return 'min';
  if (value >= max) return 'max';
  return null;
}

/** Child DOM ids derived from the stepper's `dataSet.testid` (spec). */
export function stepperPartTestId(
  testId: string | undefined,
  part: 'decrease' | 'increase' | 'value'
): string | undefined {
  return testId === undefined ? undefined : `${testId}-${part}`;
}

/** Space-separated ids, or `undefined` when there are none (pure). */
export function describedByIds(
  ...ids: readonly (string | undefined)[]
): string | undefined {
  const present = ids.filter((id): id is string => id !== undefined);
  return present.length === 0 ? undefined : present.join(' ');
}

/** 20px minus / plus drawn in the current color, like the checkbox glyph. */
function StepperGlyph(props: { plus: boolean }): JSX.Element {
  return (
    <svg class="size-5" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d={props.plus ? 'M4 10 H16 M10 4 V16' : 'M4 10 H16'}
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

function StepperButton(props: {
  onClick: () => void;
  disabled: boolean;
  'aria-label': string;
  'aria-describedby': string | undefined;
  plus: boolean;
  testId: string | undefined;
}): JSX.Element {
  return (
    <button
      class="clickable clickableTint size-11 shrink-0 items-center justify-center rounded-full border border-outline text-text"
      classList={{ 'cursor-not-allowed': props.disabled }}
      data-component="NumberStepperButton"
      data-testid={props.testId}
      type="button"
      onClick={() => props.onClick()}
      disabled={props.disabled}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      tabIndex={-1}
    >
      <StepperGlyph plus={props.plus} />
    </button>
  );
}

function onSpinKeyDown(
  event: KeyboardEvent,
  step: (delta: number) => void,
  jump: (bound: 'min' | 'max') => void,
  size: number
): void {
  const moves: Record<string, () => void> = {
    ArrowUp: () => step(size),
    ArrowRight: () => step(size),
    ArrowDown: () => step(-size),
    ArrowLeft: () => step(-size),
    Home: () => jump('min'),
    End: () => jump('max'),
  };
  const move = moves[event.key];
  if (move === undefined) return;
  event.preventDefault();
  move();
}

function useStepperModel(props: NumberStepperProps) {
  const { t } = useLingui();
  const step = (): number => props.step ?? 1;
  const off = (): boolean => props.disabled === true;
  const bound = () =>
    off() ? null : stepperBound(props.value, props.min, props.max);
  const reason = (): string | undefined => {
    const at = bound();
    if (at === 'min') return t`${props.label} is at its minimum, ${props.min}`;
    if (at === 'max') return t`${props.label} is at its maximum, ${props.max}`;
    return undefined;
  };
  const change = (delta: number): void => {
    if (off()) return;
    const next = stepValue(props.value, delta, props.min, props.max);
    if (next !== props.value) props.onChange(next);
  };
  const jump = (to: 'min' | 'max'): void => {
    if (off()) return;
    const target = to === 'min' ? props.min : props.max;
    if (target !== props.value) props.onChange(target);
  };
  return { step, off, bound, reason, change, jump };
}

/**
 * `NumberStepper` -- a labeled count with minus / plus controls (a player
 * count, a board size, a rating).
 *
 * - The value is the `stat` type style (Unbounded, tabular figures), in a
 *   `role="spinbutton"` cell with `aria-valuenow` / `min` / `max`. It is the
 *   one tab stop: the arrow keys step it, Home and End jump to the bounds.
 * - Minus and plus are 44px round secondary controls (transparent, the 3:1
 *   `outline` edge, ink glyph) with the hover / press tint. They stay out of
 *   the tab order (the spinbutton is the keyboard path) but are named and
 *   reachable by touch screen readers.
 * - At a bound the control that would pass it is disabled, and the reason
 *   ("Players is at its minimum, 2") is announced with it and with the value.
 * - `disabled` fades the whole stepper and blocks every input.
 */
export function NumberStepper(props: NumberStepperProps): JSX.Element {
  const { t } = useLingui();
  const model = useStepperModel(props);
  const reasonId = `stepper-bound-${createUniqueId()}`;
  const describedBy = (at: 'min' | 'max'): string | undefined =>
    model.bound() === at ? reasonId : undefined;
  const testId = (part: 'decrease' | 'increase' | 'value') =>
    stepperPartTestId(props.dataSet?.['testid'], part);
  return (
    <div
      class="box flex-row items-center justify-between gap-3 py-1"
      classList={{ 'opacity-disabled': model.off() }}
      {...dataAttrs({ component: 'NumberStepper', ...props.dataSet })}
    >
      <span class="text textLabel flex-1">{props.label}</span>
      <div class="box flex-row items-center gap-2">
        <StepperButton
          onClick={() => model.change(-model.step())}
          disabled={model.off() || props.value <= props.min}
          aria-label={t`Decrease ${props.label}`}
          aria-describedby={describedBy('min')}
          plus={false}
          testId={testId('decrease')}
        />
        <div
          class="text textStat min-w-12 text-center"
          role="spinbutton"
          data-testid={testId('value')}
          tabIndex={model.off() ? -1 : 0}
          aria-label={props.label}
          aria-valuenow={props.value}
          aria-valuemin={props.min}
          aria-valuemax={props.max}
          aria-describedby={describedByIds(
            model.bound() === null ? undefined : reasonId,
            props['aria-describedby']
          )}
          aria-disabled={model.off() ? true : undefined}
          onKeyDown={(event) =>
            onSpinKeyDown(event, model.change, model.jump, model.step())
          }
        >
          {String(props.value)}
        </div>
        <StepperButton
          onClick={() => model.change(model.step())}
          disabled={model.off() || props.value >= props.max}
          aria-label={t`Increase ${props.label}`}
          aria-describedby={describedBy('max')}
          plus
          testId={testId('increase')}
        />
      </div>
      <Show when={model.reason()}>
        {(reason) => (
          <span class="sr-only" id={reasonId}>
            {reason()}
          </span>
        )}
      </Show>
    </div>
  );
}
