import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
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

/**
 * Quiet, wrapping facts: a caption, the number in the `stat` role, and an
 * optional footnote. Values retain their units and never imply a verdict;
 * a count that can pass 1,000 is passed compact (`formatCompactNumber`).
 */
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
            <dd class="text textStat m-0">{metric.value}</dd>
            <dd class="text textFootnote m-0">{metric.detail}</dd>
          </div>
        )}
      </For>
    </dl>
  );
}
