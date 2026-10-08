import { useLingui } from '@lingui/solid/macro';
import { measuredMs } from '@pkgs/harness-report-shared/performance';
import type { HtmlReportTest } from '@pkgs/harness-root-shared/bundle';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { MetricStrip } from '@pkgs/ui-root-client/metric-strip';
import { createMemo, For, Show } from 'solid-js';
import { PerformanceHeatmap } from './performance-heatmap';

export function PerformanceOverview(props: {
  tests: readonly HtmlReportTest[];
  onOpen: (id: string) => void;
}) {
  const { t } = useLingui();
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
    <div class="box gap-4" data-component="PerformanceOverview">
      <h2 class="text textSubtitle">{t`App performance`}</h2>
      <p class="text textCaption">{t`${measured().length} / ${props.tests.length} runs measured`}</p>
      <PerformanceHeatmap cells={cells()} onSelect={props.onOpen} />
      <Show
        when={expensive().length > 0}
        fallback={
          <EmptyState
            variant="compact"
            title={t`Measurements unavailable`}
            body={t`These reports contain no recorded performance measurements.`}
          />
        }
      >
        <MenuSection title={t`Most expensive runs`}>
          <For each={expensive()}>
            {(test) => (
              <MenuRow
                title={test.report.meta.title}
                caption={
                  <MetricStrip
                    aria-label={t`Recorded run timing`}
                    metrics={[
                      {
                        label: t`Work`,
                        value: measuredMs(
                          test.report.meta.performance!.executionMs
                        ),
                      },
                      {
                        label: t`Snapshots`,
                        value: measuredMs(
                          test.report.meta.performance!.snapshotMs
                        ),
                      },
                      {
                        label: t`Slow steps`,
                        value: test.report.meta.performance!.slowSteps,
                      },
                    ]}
                  />
                }
                onClick={() => props.onOpen(test.report.meta.testId)}
              />
            )}
          </For>
        </MenuSection>
      </Show>
    </div>
  );
}
