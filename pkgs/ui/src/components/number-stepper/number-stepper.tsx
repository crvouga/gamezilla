/** @jsxImportSource solid-js */
/**
 * `NumberStepper` -- labeled numeric value with decrement / increment controls.
 * The value cell exposes `role="spinbutton"` with `aria-valuenow/min/max` and
 * supports arrow-key stepping.
 */

import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { Text } from '../text';

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

function StepperButton(props: {
  onClick: () => void;
  disabled: boolean;
  'aria-label': string;
  glyph: string;
}): JSX.Element {
  return (
    <Clickable
      onClick={() => props.onClick()}
      disabled={props.disabled}
      aria-label={props['aria-label']}
      tabIndex={-1}
      sx={{
        minWidth: 40,
        minHeight: 40,
        alignItems: 'center',
        justifyContent: 'center',
        py: 2,
        borderRadius: 'sm',
        opacity: props.disabled ? 0.4 : 1,
      }}
    >
      <Text variant="title" label={props.glyph} />
    </Clickable>
  );
}

export function NumberStepper(props: NumberStepperProps): JSX.Element {
  const { t } = useLingui();
  const step = (): number => props.step ?? 1;
  const change = (delta: number): void => {
    const next = stepValue(props.value, delta, props.min, props.max);
    if (next !== props.value) props.onChange(next);
  };
  return (
    <Box
      dataSet={{ component: 'NumberStepper', ...props.dataSet }}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 3,
        py: 1,
      }}
    >
      <Text variant="label" sx={{ flex: 1 }} label={props.label} />
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <StepperButton
          onClick={() => change(-step())}
          disabled={props.disabled === true || props.value <= props.min}
          aria-label={t`Decrease ${props.label}`}
          glyph="−"
        />
        <Text
          role="spinbutton"
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
            }
          }}
          variant="body"
          sx={{
            fontVariant: ['tabular-nums'],
            minWidth: 48,
            textAlign: 'center',
            color: 'text',
          }}
          label={String(props.value)}
        />
        <StepperButton
          onClick={() => change(step())}
          disabled={props.disabled === true || props.value >= props.max}
          aria-label={t`Increase ${props.label}`}
          glyph="+"
        />
      </Box>
    </Box>
  );
}
