import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { For, type JSX } from 'solid-js';

export type SummaryMetric = {
  readonly label: JSX.Element;
  readonly value: JSX.Element;
  readonly detail?: JSX.Element;
};
export type MetricStripProps = {
  readonly metrics: readonly SummaryMetric[];
  readonly 'aria-label': string;
  readonly dataSet?: ComponentDataSet;
};

/** Quiet, wrapping facts. Values retain their units and never imply a verdict. */
export function MetricStrip(props: MetricStripProps): JSX.Element {
  return (
    <dl
      aria-label={props['aria-label']}
      class="box flex-row flex-wrap gap-x-8 gap-y-3 py-3"
      {...dataAttrs({ component: 'MetricStrip', ...props.dataSet })}
    >
      <For each={props.metrics}>
        {(metric) => (
          <div class="box gap-1 min-w-0">
            <dt class="text textCaption">{metric.label}</dt>
            <dd class="text textHeading textNumeral m-0">{metric.value}</dd>
            <span class="text textFootnote">{metric.detail}</span>
          </div>
        )}
      </For>
    </dl>
  );
}
