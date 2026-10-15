import {
  type ComponentDataSet,
  dataAttrs,
} from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
import { clamp01, ProgressBar } from './progress-bar';

export type LinearProgressProps = {
  label: string;
  /** Fraction completed; omit when the total is not known. */
  progress?: number;
  description?: JSX.Element;
  dataSet?: ComponentDataSet;
};

/** Named linear progress with the same determinate value in text and accessibility. */
export function LinearProgress(props: LinearProgressProps): JSX.Element {
  const known = () => props.progress !== undefined;
  const value = () => clamp01(props.progress ?? 0);
  return (
    <div
      class="box gap-2 w-full min-w-0"
      {...dataAttrs({ component: 'LinearProgress', ...props.dataSet })}
    >
      <div class="box flex-row items-baseline justify-between gap-3">
        <span class="text textLabel">{props.label}</span>
        <Show when={known()}>
          <span class="text textCaption textNumeral">
            {Math.floor(value() * 100)}%
          </span>
        </Show>
      </div>
      <ProgressBar
        progress={value()}
        indeterminate={!known()}
        label={props.label}
      />
      <Show when={props.description}>
        <div class="text textCaption">{props.description}</div>
      </Show>
    </div>
  );
}
