import { Box, ScrollView, Text } from '@pkgs/ui';
import { useEffect } from 'react';
import type { SystemConsolePorts } from '../shared/ports';
import { isLatestRunId } from '../types';
import type { ReportApiClient } from './api-client';
import type { DebuggerChromeNav } from './debugger-chrome';
import type { ReportNavState } from './router';
import { clearPlayerNav, navigateReport } from './router';
import { RunsPage } from './runs-page';
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

export function ReportViews(props: {
  readonly nav: ReportNavState;
  readonly data: ReportDataApi;
  readonly generation: number;
  readonly onNav: (nav: ReportNavState) => void;
  readonly api: ReportApiClient;
  readonly chrome: DebuggerChromeNav;
  readonly ports: SystemConsolePorts;
}) {
  const { nav, data, generation, onNav, api, chrome, ports } = props;
  const concreteRunId = data.resolvedRunId;

  useEffect(() => {
    if (nav.bucketId) return;
    if (!data.buckets.some((b) => b.id === LOCAL_BUCKET)) return;
    onNav(
      navigateReport(nav, clearPlayerNav({ bucketId: LOCAL_BUCKET }), 'replace')
    );
  }, [data.buckets, nav, onNav]);

  if (!nav.bucketId) {
    return (
      <Box sx={appShellSx}>
        <Box sx={appBodyFrameSx}>
          <Text sx={emptySx}>
            {data.buckets.length === 0
              ? 'Waiting for report bucket…'
              : 'Opening local bucket…'}
          </Text>
        </Box>
      </Box>
    );
  }

  if (!nav.runId) {
    return (
      <RunsListView
        nav={nav}
        data={data}
        generation={generation}
        onNav={onNav}
        api={api}
      />
    );
  }

  const runLabel = isLatestRunId(nav.runId)
    ? concreteRunId
      ? `latest → ${concreteRunId}`
      : 'latest (waiting…)'
    : nav.runId;

  if (nav.testId) {
    return (
      <TestOrLoading
        nav={nav}
        data={data}
        concreteRunId={concreteRunId}
        onNav={onNav}
        api={api}
        chrome={chrome}
        ports={ports}
      />
    );
  }

  return (
    <SuitePage
      bucketId={nav.bucketId}
      runId={runLabel}
      tests={data.tests}
      onOpenTest={(testId) => {
        onNav(navigateReport(nav, clearPlayerNav({ testId })));
      }}
    />
  );
}

function RunsListView(props: {
  readonly nav: ReportNavState;
  readonly data: ReportDataApi;
  readonly generation: number;
  readonly onNav: (nav: ReportNavState) => void;
  readonly api: ReportApiClient;
}) {
  const { nav, data, generation, onNav, api } = props;
  return (
    <RunsPage
      bucketId={nav.bucketId!}
      runs={data.runs}
      generation={generation}
      onOpenRun={(runId) => {
        onNav(navigateReport(nav, clearPlayerNav({ runId })));
      }}
      onDeleteRun={async (runId) => {
        await api.deleteRunApi(nav.bucketId!, runId);
      }}
    />
  );
}

function TestOrLoading(props: {
  readonly nav: ReportNavState;
  readonly data: ReportDataApi;
  readonly concreteRunId: string | null;
  readonly onNav: (nav: ReportNavState) => void;
  readonly api: ReportApiClient;
  readonly chrome: DebuggerChromeNav;
  readonly ports: SystemConsolePorts;
}) {
  const { nav, data, concreteRunId, onNav, api, chrome, ports } = props;
  const bodySx = useAppBodyContentSx();
  if (!concreteRunId) {
    return (
      <Box sx={appShellSx}>
        <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
          <Text sx={emptySx}>
            {isLatestRunId(nav.runId)
              ? 'Waiting for the latest run…'
              : data.error
                ? `Failed to resolve run: ${data.error}`
                : 'Loading run…'}
          </Text>
        </ScrollView>
      </Box>
    );
  }
  if (!data.testData) {
    return (
      <Box sx={appShellSx}>
        <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
          <Text sx={emptySx}>
            {data.error
              ? `Failed to load test: ${data.error}`
              : 'Loading test…'}
          </Text>
        </ScrollView>
      </Box>
    );
  }
  return (
    <TestPage
      data={data.testData}
      nav={nav}
      bucketId={nav.bucketId!}
      runId={concreteRunId}
      onNav={onNav}
      api={api}
      chrome={chrome}
      ports={ports}
    />
  );
}
