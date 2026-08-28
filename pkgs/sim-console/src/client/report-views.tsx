import { Box, ScrollView, Text } from '@pkgs/ui';
import { useEffect } from 'react';
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

export function ReportViews(props: {
  readonly nav: ReportNavState;
  readonly data: ReportDataApi;
  readonly generation: number;
  readonly onNav: (nav: ReportNavState) => void;
  readonly api: ReportApiClient;
}) {
  const { nav, data, onNav, api } = props;
  const concreteRunId = data.resolvedRunId;

  useEffect(() => {
    if (nav.bucketId) return;
    if (!data.buckets.some((b) => b.id === LOCAL_BUCKET)) return;
    onNav(
      navigateReport(
        nav,
        clearPlayerNav({ bucketId: LOCAL_BUCKET, runId: LATEST_RUN_ID }),
        'replace'
      )
    );
  }, [data.buckets, nav, onNav]);

  useEffect(() => {
    if (!nav.bucketId || nav.runId) return;
    onNav(
      navigateReport(nav, clearPlayerNav({ runId: LATEST_RUN_ID }), 'replace')
    );
  }, [nav, onNav]);

  if (!nav.bucketId || !nav.runId) {
    return (
      <Box sx={appShellSx}>
        <Box sx={appBodyFrameSx}>
          <Text sx={emptySx}>
            {data.buckets.length === 0
              ? 'Waiting for report bucket…'
              : 'Opening latest reports…'}
          </Text>
        </Box>
      </Box>
    );
  }

  const runLabel = isLatestRunId(nav.runId)
    ? concreteRunId
      ? `latest → ${concreteRunId}`
      : 'latest'
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

  if (data.runs.length === 0 && data.tests.length === 0) {
    return (
      <Box sx={appShellSx}>
        <Box sx={appBodyFrameSx}>
          <Text sx={emptySx}>
            No report dump yet. Run `@sim/test` to write the latest results into
            `sim/console/public/reports`.
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <SuitePage
      bucketId={nav.bucketId}
      runId={runLabel}
      tests={data.tests}
      updatedAtMs={data.suiteUpdatedAtMs}
      onOpenTest={(testId) => {
        onNav(navigateReport(nav, clearPlayerNav({ testId })));
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
  const bodySx = useAppBodyContentSx();
  if (!concreteRunId) {
    return (
      <Box sx={appShellSx}>
        <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
          <Text sx={emptySx}>
            {data.runs.length === 0
              ? 'No report dump yet. Run `@sim/test` to generate reports.'
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
      tests={data.tests}
      nav={nav}
      bucketId={nav.bucketId!}
      runId={concreteRunId}
      onNav={onNav}
      api={api}
    />
  );
}
