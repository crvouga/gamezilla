import { Box, ScrollView, Text } from '@pkgs/ui';
import { useEffect } from 'react';

import { isLatestRunId, LATEST_RUN_ID } from '../types';
import type { ReportApiClient } from './api-client';
import { NavBreadcrumb } from './nav-breadcrumb';
import { ReportHeader } from './report-header';
import type { ReportNavState } from './router';
import { clearPlayerNav, navigateReport } from './router';
import { RunsPage } from './runs-page';
import { SuitePage } from './suite-page';
import { TestPage } from './test-page';
import { appBodyContentSx, appBodyFrameSx, appShellSx, emptySx } from './tokens';
import type { ReportDataApi } from './use-report-data';

const LOCAL_BUCKET = 'local';

export function ReportViews(props: {
  readonly nav: ReportNavState;
  readonly data: ReportDataApi;
  readonly generation: number;
  readonly onNav: (nav: ReportNavState) => void;
  readonly api: ReportApiClient;
}) {
  const { nav, data, generation, onNav, api } = props;
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
        <ReportHeader breadcrumb={<Text sx={{ color: '#d7dde8' }}>Reports</Text>} />
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
      />
    );
  }

  return (
    <SuitePage
      nav={nav}
      buckets={data.buckets}
      runs={data.runs}
      bucketId={nav.bucketId}
      runId={runLabel}
      tests={data.tests}
      onNav={onNav}
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
      nav={nav}
      buckets={data.buckets}
      tests={data.tests}
      bucketId={nav.bucketId!}
      runs={data.runs}
      generation={generation}
      onNav={onNav}
      onBack={() => {
        onNav(
          navigateReport(nav, clearPlayerNav({ bucketId: null, runId: null }))
        );
      }}
      onOpenRun={(runId) => {
        onNav(navigateReport(nav, clearPlayerNav({ runId })));
      }}
      onOpenLatest={() => {
        onNav(navigateReport(nav, clearPlayerNav({ runId: LATEST_RUN_ID })));
      }}
      onDeleteRun={async (runId) => {
        await api.deleteRunApi(nav.bucketId!, runId);
      }}
      onKeepLast={async (n) => {
        await api.pruneBucket(nav.bucketId!, { keepLast: n });
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
}) {
  const { nav, data, concreteRunId, onNav, api } = props;
  const crumb = (
    <NavBreadcrumb
      nav={nav}
      buckets={data.buckets}
      runs={data.runs}
      tests={data.tests}
      onNav={onNav}
    />
  );
  if (!concreteRunId) {
    return (
      <Box sx={appShellSx}>
        <ReportHeader breadcrumb={crumb} />
        <ScrollView frameSx={appBodyFrameSx} sx={appBodyContentSx}>
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
        <ReportHeader breadcrumb={crumb} />
        <ScrollView frameSx={appBodyFrameSx} sx={appBodyContentSx}>
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
      buckets={data.buckets}
      runs={data.runs}
      tests={data.tests}
      onNav={onNav}
      api={api}
    />
  );
}
