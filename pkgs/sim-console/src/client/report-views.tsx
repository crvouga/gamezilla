import { ScrollView } from '@pkgs/ui';
import { createEffect, createSignal, Match, Show, Switch } from 'solid-js';
import { isLatestRunId, LATEST_RUN_ID } from '../types';
import type { ReportApiClient } from './api-client';
import type { ReportNavState } from './router';
import { clearPlayerNav, navigateReport } from './router';
import { SuitePage } from './suite-page';
import { TestPage } from './test-page';
import {
  appBodyFrameSx,
  appShellSx,
  emptySx,
  useAppBodyContentSx,
} from './tokens';
import type { ReportDataApi } from './use-report-data';

const LOCAL_BUCKET = 'local';

const fillSx = {
  flex: 1,
  'min-height': 0,
  'min-width': 0,
} as const;

function visibilitySx(active: boolean) {
  return {
    ...fillSx,
    display: active ? ('flex' as const) : ('none' as const),
    pointerEvents: active ? ('auto' as const) : ('none' as const),
  };
}

export function ReportViews(props: {
  readonly nav: ReportNavState;
  readonly data: ReportDataApi;
  readonly generation: number;
  readonly onNav: (nav: ReportNavState, mode?: 'push' | 'replace') => void;
  readonly api: ReportApiClient;
}) {
  const [testVisited, setTestVisited] = createSignal(props.nav.testId != null);

  createEffect(() => {
    if (props.nav.testId != null) setTestVisited(true);
  });

  createEffect(() => {
    const nav = props.nav;
    if (nav.bucketId) return;
    if (!props.data.buckets.some((b) => b.id === LOCAL_BUCKET)) return;
    props.onNav(
      navigateReport(
        nav,
        clearPlayerNav({ bucketId: LOCAL_BUCKET, runId: LATEST_RUN_ID })
      ),
      'replace'
    );
  });

  createEffect(() => {
    const nav = props.nav;
    if (!nav.bucketId || nav.runId) return;
    props.onNav(
      navigateReport(nav, clearPlayerNav({ runId: LATEST_RUN_ID })),
      'replace'
    );
  });

  const showTest = () => props.nav.testId != null;
  const waiting = () => !props.nav.bucketId || !props.nav.runId;
  const emptySuite = () =>
    !showTest() &&
    props.data.runs.length === 0 &&
    props.data.tests.length === 0;

  const runLabel = () => {
    const concreteRunId = props.data.resolvedRunId;
    return isLatestRunId(props.nav.runId)
      ? concreteRunId
        ? `latest → ${concreteRunId}`
        : 'latest'
      : props.nav.runId;
  };

  return (
    <Switch>
      <Match when={waiting()}>
        <div class="box" style={appShellSx}>
          <div class="box" style={appBodyFrameSx}>
            <p class="text" style={emptySx}>
              {props.data.buckets.length === 0
                ? 'Waiting for report bucket…'
                : 'Opening latest reports…'}
            </p>
          </div>
        </div>
      </Match>
      <Match when={emptySuite()}>
        <div class="box" style={appShellSx}>
          <div class="box" style={appBodyFrameSx}>
            <p class="text" style={emptySx}>
              No report dump yet. Run `@apps/product` to write the latest
              results into `apps/product/public/reports`.
            </p>
          </div>
        </div>
      </Match>
      <Match when={true}>
        <div class="box" style={fillSx}>
          <div class="box" style={visibilitySx(!showTest())}>
            <SuitePage
              bucketId={props.nav.bucketId ?? ''}
              runId={runLabel() ?? ''}
              tests={props.data.tests}
              updatedAtMs={props.data.suiteUpdatedAtMs}
              onOpenTest={(testId) => {
                props.onNav(
                  navigateReport(props.nav, clearPlayerNav({ testId }))
                );
              }}
            />
          </div>
          <Show when={testVisited()}>
            <div class="box" style={visibilitySx(showTest())}>
              <TestOrLoading
                nav={props.nav}
                data={props.data}
                concreteRunId={props.data.resolvedRunId}
                onNav={props.onNav}
                api={props.api}
              />
            </div>
          </Show>
        </div>
      </Match>
    </Switch>
  );
}

function TestOrLoading(props: {
  readonly nav: ReportNavState;
  readonly data: ReportDataApi;
  readonly concreteRunId: string | null;
  readonly onNav: (nav: ReportNavState, mode?: 'push' | 'replace') => void;
  readonly api: ReportApiClient;
}) {
  const bodySx = useAppBodyContentSx();
  return (
    <Switch>
      <Match when={props.nav.testId == null}>
        <div class="box" style={fillSx} />
      </Match>
      <Match when={!props.concreteRunId}>
        <div class="box" style={appShellSx}>
          <ScrollView style={appBodyFrameSx} contentStyle={bodySx}>
            <p class="text" style={emptySx}>
              {props.data.runs.length === 0
                ? 'No report dump yet. Run `@apps/product` to generate reports.'
                : props.data.error
                  ? `Failed to resolve run: ${props.data.error}`
                  : 'Loading run…'}
            </p>
          </ScrollView>
        </div>
      </Match>
      <Match when={props.data.testData}>
        {(testData) => (
          <TestPage
            data={testData()}
            tests={props.data.tests}
            nav={props.nav}
            bucketId={props.nav.bucketId ?? ''}
            runId={props.concreteRunId ?? ''}
            onNav={props.onNav}
            api={props.api}
          />
        )}
      </Match>
      <Match when={true}>
        <div class="box" style={appShellSx}>
          <ScrollView style={appBodyFrameSx} contentStyle={bodySx}>
            <p class="text" style={emptySx}>
              {props.data.error
                ? `Failed to load test: ${props.data.error}`
                : 'Loading test…'}
            </p>
          </ScrollView>
        </div>
      </Match>
    </Switch>
  );
}
