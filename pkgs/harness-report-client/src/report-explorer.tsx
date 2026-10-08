import { useLingui } from '@lingui/solid/macro';
import type { ReportPart } from '@pkgs/harness-report-shared/explorer-types';
import type { SourceRecord } from '@pkgs/harness-report-shared/protocol';
import { sourceParts } from '@pkgs/harness-report-shared/source-part';
import { MetricStrip } from '@pkgs/ui-root-client/metric-strip';
import { Notice } from '@pkgs/ui-root-client/notice';
import { SegmentedControl } from '@pkgs/ui-root-client/segmented-control';
import { createMemo, Match, Show, Switch } from 'solid-js';
import type { ExplorerResource } from './explorer-resource';
import { ListView } from './list-view';
import { useReport } from './report-context';
import { ReportPartsView } from './report-parts-view';
import { SpecBrowser } from './spec-browser';
import type { ReportNav } from './use-report-nav';

export function ReportExplorer(props: {
  readonly nav: ReportNav;
  readonly resource: ExplorerResource;
  readonly sources: readonly SourceRecord[];
  readonly sha: string;
}) {
  const { t } = useLingui();
  const report = useReport();
  const partsForSource = createSourcePartCache(() => props.sha);
  const parts = createMemo(() => {
    const published = props.resource.data()?.parts ?? [];
    const ids = new Set(published.map((part) => part.id));
    return [
      ...published,
      ...props.sources
        .flatMap(partsForSource)
        .filter((part) => !ids.has(part.id)),
    ];
  });
  const segments = createMemo(() => [
    { key: 'specs', label: t`Specs` },
    { key: 'tests', label: t`Test runs` },
    { key: 'ui-quality', label: t`UI quality` },
    { key: 'performance', label: t`Performance` },
    ...extraSegments(parts()),
  ]);
  const mode = () =>
    segments().some(
      (segment) => segment.key === props.nav.route().params['tab']
    )
      ? props.nav.route().params['tab']!
      : 'specs';
  const select = (patch: Record<string, string>) =>
    props.nav.navigate(
      { view: 'list', params: { ...props.nav.route().params, ...patch } },
      true
    );
  const open = (id: string) =>
    props.nav.navigate({
      view: 'test',
      testId: id,
      params: props.nav.route().params,
    });
  return (
    <div
      class="box flex-1 min-h-0 min-w-0 gap-4"
      data-testid="report-explorer"
      data-state={
        props.resource.pending()
          ? 'loading'
          : props.resource.error()
            ? 'error'
            : 'ready'
      }
    >
      <ExplorerSummary resource={props.resource} partsCount={parts().length} />
      <Show when={props.resource.data()?.notice}>
        {(notice) => <Notice>{notice()}</Notice>}
      </Show>
      <Show when={props.resource.error()}>
        <Notice tone="error">{t`The inventory or report parts could not be read. Refresh to try again. Missing evidence is not a passing result.`}</Notice>
      </Show>
      <div class="box overflow-x-auto shrink-0">
        <SegmentedControl
          aria-label={t`Explore evidence`}
          segments={segments()}
          selected={mode()}
          onSelect={(tab) => select({ tab, partq: '' })}
          dataSet={{ testid: 'report-sections' }}
        />
      </div>
      <Switch
        fallback={
          <ReportPartsView
            kind={mode()}
            initialQuery={props.nav.route().params['partq']}
            parts={parts()}
            unavailable={
              !!props.resource.error() || !!props.resource.data()?.notice
            }
            onOpen={open}
            canOpen={(id) =>
              report.data.tests.some((test) => test.report.meta.testId === id)
            }
          />
        }
      >
        <Match when={mode() === 'specs'}>
          <SpecBrowser
            resource={props.resource}
            tests={report.data.tests}
            selected={props.nav.route().params['spec'] ?? ''}
            onSelect={(spec) => select({ spec })}
            onOpenPart={(tab, partq) => select({ tab, partq })}
            onOpen={open}
          />
        </Match>
        <Match when={mode() === 'tests'}>
          <ListView nav={props.nav} performance={false} />
        </Match>
      </Switch>
    </div>
  );
}

function extraSegments(parts: readonly ReportPart[]) {
  const known = new Set(['behavior', 'ui-quality', 'performance']);
  return [
    ...new Map(
      parts
        .filter((part) => !known.has(part.kind))
        .map((part) => [part.kind, { key: part.kind, label: part.kind }])
    ).values(),
  ];
}

function ExplorerSummary(props: {
  resource: ExplorerResource;
  partsCount: number;
}) {
  const { t } = useLingui();
  const report = useReport();
  return (
    <MetricStrip
      aria-label={t`Version evidence`}
      metrics={[
        {
          label: t`Specs`,
          value: props.resource.data()?.inventory?.entries.length ?? '—',
        },
        { label: t`Test reports`, value: report.data.tests.length },
        {
          label: t`Failed reports`,
          value: report.data.tests.filter(
            (test) => test.report.meta.status === 'failed'
          ).length,
        },
        { label: t`Report parts`, value: props.partsCount },
      ]}
    />
  );
}

function createSourcePartCache(sha: () => string) {
  const converted = new WeakMap<
    SourceRecord,
    { sha: string; parts: readonly ReportPart[] }
  >();
  return (source: SourceRecord) => {
    const found = converted.get(source);
    if (found?.sha === sha()) return found.parts;
    const parts = sourceParts(sha(), source);
    converted.set(source, { sha: sha(), parts });
    return parts;
  };
}
