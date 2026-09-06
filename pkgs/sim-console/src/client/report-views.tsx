import { Box, ScrollView, Text } from '@pkgs/ui';
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
  minHeight: 0,
  minWidth: 0,
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
        <Box sx={appShellSx}>
          <Box sx={appBodyFrameSx}>
            <Text sx={emptySx}>
              {props.data.buckets.length === 0
                ? 'Waiting for report bucket…'
                : 'Opening latest reports…'}
            </Text>
          </Box>
        </Box>
      </Match>
      <Match when={emptySuite()}>
        <Box sx={appShellSx}>
          <Box sx={appBodyFrameSx}>
            <Text sx={emptySx}>
              No report dump yet. Run `@product/test` to write the latest
              results into `product/console/public/reports`.
            </Text>
          </Box>
        </Box>
      </Match>
      <Match when={true}>
        <Box sx={fillSx}>
          <Box sx={visibilitySx(!showTest())}>
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
          </Box>
          <Show when={testVisited()}>
            <Box sx={visibilitySx(showTest())}>
              <TestOrLoading
                nav={props.nav}
                data={props.data}
                concreteRunId={props.data.resolvedRunId}
                onNav={props.onNav}
                api={props.api}
              />
            </Box>
          </Show>
        </Box>
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
        <Box sx={fillSx} />
      </Match>
      <Match when={!props.concreteRunId}>
        <Box sx={appShellSx}>
          <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
            <Text sx={emptySx}>
              {props.data.runs.length === 0
                ? 'No report dump yet. Run `@product/test` to generate reports.'
                : props.data.error
                  ? `Failed to resolve run: ${props.data.error}`
                  : 'Loading run…'}
            </Text>
          </ScrollView>
        </Box>
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
        <Box sx={appShellSx}>
          <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
            <Text sx={emptySx}>
              {props.data.error
                ? `Failed to load test: ${props.data.error}`
                : 'Loading test…'}
            </Text>
          </ScrollView>
        </Box>
      </Match>
    </Switch>
  );
}
