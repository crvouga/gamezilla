import { measuredMs } from '@pkgs/harness-report-shared/performance';
import type { HtmlReportTest } from '@pkgs/harness-root-shared/bundle';
import { createMemo, For, Show } from 'solid-js';
import { PerformanceHeatmap } from './performance-heatmap';

export function PerformanceOverview(props: {
  tests: readonly HtmlReportTest[];
  onOpen: (id: string) => void;
}) {
  const measured = createMemo(() =>
    props.tests.filter((test) => test.report.meta.performance !== undefined)
  );
  const expensive = createMemo(() =>
    [...measured()]
      .sort(
        (a, b) =>
          b.report.meta.performance!.executionMs -
          a.report.meta.performance!.executionMs
      )
      .slice(0, 15)
  );
  const cells = createMemo(() =>
    props.tests.map((test, i) => {
      const meta = test.report.meta;
      const sample = meta.performance;
      return {
        id: meta.testId,
        label: String(i + 1),
        band:
          sample === undefined
            ? ('unmeasured' as const)
            : sample.slowSteps > 0
              ? ('slow' as const)
              : ('cool' as const),
        detail: `${meta.title}: ${sample === undefined ? 'unmeasured' : `${measuredMs(sample.executionMs)} work · ${sample.slowSteps} slow steps`}`,
      };
    })
  );
  return (
    <details
      class="sr-performance sr-performance-overview"
      data-component="PerformanceOverview"
    >
      <summary>
        App performance{' '}
        <span class="sr-badge">{`${measured().length} / ${props.tests.length} runs measured`}</span>
      </summary>
      <p class="sr-performance-note">
        Recorded elapsed work across the spec suite. Open a run for its step
        heatmap and snapshot overhead. Grey runs have no measurements.
      </p>
      <PerformanceHeatmap cells={cells()} onSelect={props.onOpen} />
      <Show
        when={expensive().length > 0}
        fallback={<p>Measurements are unavailable for these reports.</p>}
      >
        <table>
          <thead>
            <tr>
              <th>Most expensive runs</th>
              <th>Work</th>
              <th>Snapshots</th>
              <th>Slow steps</th>
            </tr>
          </thead>
          <tbody>
            <For each={expensive()}>
              {(test) => (
                <tr>
                  <td>
                    <button
                      type="button"
                      onClick={() => props.onOpen(test.report.meta.testId)}
                    >
                      {test.report.meta.title}
                    </button>
                  </td>
                  <td>
                    {measuredMs(test.report.meta.performance!.executionMs)}
                  </td>
                  <td>
                    {measuredMs(test.report.meta.performance!.snapshotMs)}
                  </td>
                  <td>{test.report.meta.performance!.slowSteps}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </details>
  );
}
