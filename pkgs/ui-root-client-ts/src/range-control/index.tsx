import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import styles from './range-control.module.css';

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
  /**
   * `vertical` stands the control upright, `min` at the top, filling the
   * height its row gives it: for a value that moves up and down (a paddle).
   */
  orientation?: 'horizontal' | 'vertical' | undefined;
  dataSet?: ComponentDataSet;
};

/** Native keyboard and pointer seeking with the shared control size and palette. */
export function RangeControl(props: RangeControlProps) {
  return (
    <input
      {...dataAttrs({ component: 'RangeControl', ...props.dataSet })}
      class={
        props.orientation === 'vertical'
          ? `box accent-tint bg-transparent cursor-pointer ${styles['vertical']}`
          : 'box w-full min-h-11 accent-tint bg-transparent cursor-pointer'
      }
      aria-orientation={props.orientation}
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
