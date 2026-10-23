/** @jsxImportSource solid-js */
/**
 * `NumberStepper` -- labeled numeric value with decrement / increment controls.
 * The value cell exposes `role="spinbutton"` with `aria-valuenow/min/max` and
 * supports arrow-key stepping.
 */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

export type NumberStepperProps = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number | undefined;
  disabled?: boolean | undefined;
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

/** Child DOM ids derived from the stepper's `dataSet.testid` (spec). */
export function stepperPartTestId(
  testId: string | undefined,
  part: 'decrease' | 'increase' | 'value'
): string | undefined {
  return testId === undefined ? undefined : `${testId}-${part}`;
}

function StepperButton(props: {
  onClick: () => void;
  disabled: boolean;
  'aria-label': string;
  glyph: string;
  testId: string | undefined;
}): JSX.Element {
  return (
    <button
      class="clickable clickableTint min-w-10 min-h-10 items-center justify-center rounded-sm"
      data-testid={props.testId}
      type="button"
      style={{ opacity: props.disabled ? 0.4 : 1 }}
      onClick={() => props.onClick()}
      disabled={props.disabled}
      aria-label={props['aria-label']}
      tabIndex={-1}
    >
      <span class="text textLabel leading-none">{props.glyph}</span>
    </button>
  );
}

export function NumberStepper(props: NumberStepperProps): JSX.Element {
  const { t } = useLingui();
  const step = (): number => props.step ?? 1;
  const change = (delta: number): void => {
    const next = stepValue(props.value, delta, props.min, props.max);
    if (next !== props.value) props.onChange(next);
  };
  const changeTo = (target: number): void => {
    if (target !== props.value) props.onChange(target);
  };
  return (
    <div
      class="box flex-row items-center justify-between gap-3 py-1"
      {...dataAttrs({ component: 'NumberStepper', ...props.dataSet })}
    >
      <label class="text textLabel flex-1">{props.label}</label>
      <div class="box flex-row items-center gap-2">
        <StepperButton
          onClick={() => change(-step())}
          disabled={props.disabled === true || props.value <= props.min}
          aria-label={t`Decrease ${props.label}`}
          glyph="−"
          testId={stepperPartTestId(props.dataSet?.['testid'], 'decrease')}
        />
        <div
          class="text min-w-12 text-center text-text"
          role="spinbutton"
          data-testid={stepperPartTestId(props.dataSet?.['testid'], 'value')}
          tabIndex={props.disabled === true ? -1 : 0}
          aria-label={props.label}
          aria-valuenow={props.value}
          aria-valuemin={props.min}
          aria-valuemax={props.max}
          aria-disabled={props.disabled === true ? true : undefined}
          onKeyDown={(ev) => {
            if (props.disabled === true) return;
            if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') {
              ev.preventDefault();
              change(step());
            } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') {
              ev.preventDefault();
              change(-step());
            } else if (ev.key === 'Home') {
              ev.preventDefault();
              changeTo(props.min);
            } else if (ev.key === 'End') {
              ev.preventDefault();
              changeTo(props.max);
            }
          }}
        >
          {String(props.value)}
        </div>
        <StepperButton
          onClick={() => change(step())}
          disabled={props.disabled === true || props.value >= props.max}
          aria-label={t`Increase ${props.label}`}
          glyph="+"
          testId={stepperPartTestId(props.dataSet?.['testid'], 'increase')}
        />
      </div>
    </div>
  );
}
