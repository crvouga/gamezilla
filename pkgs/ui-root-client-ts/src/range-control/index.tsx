import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';

export type RangeControlProps = {
  label: string;
  min: number;
  max: number;
  value: number;
  valueText?: string;
  step?: number;
  disabled?: boolean;
  onInput: (value: number) => void;
  onCommit?: () => void;
  dataSet?: ComponentDataSet;
};

/** Native keyboard and pointer seeking with the shared control size and palette. */
export function RangeControl(props: RangeControlProps) {
  return (
    <input
      {...dataAttrs({ component: 'RangeControl', ...props.dataSet })}
      class="box w-full min-h-11 accent-tint bg-transparent cursor-pointer"
      type="range"
      aria-label={props.label}
      aria-valuetext={props.valueText}
      min={props.min}
      max={Math.max(props.min, props.max)}
      value={props.value}
      step={props.step ?? 1}
      disabled={props.disabled}
      onInput={(event) => props.onInput(event.currentTarget.valueAsNumber)}
      onChange={() => props.onCommit?.()}
    />
  );
}
