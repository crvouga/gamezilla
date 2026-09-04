import { Box, ScrollView, Text } from '@pkgs/ui';
import { useEffect, useState } from 'react';
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
  const { nav, data, onNav, api } = props;
  const concreteRunId = data.resolvedRunId;
  const [testVisited, setTestVisited] = useState(() => nav.testId != null);

  useEffect(() => {
    if (nav.testId != null) setTestVisited(true);
  }, [nav.testId]);

  useEffect(() => {
    if (nav.bucketId) return;
    if (!data.buckets.some((b) => b.id === LOCAL_BUCKET)) return;
    onNav(
      navigateReport(
        nav,
        clearPlayerNav({ bucketId: LOCAL_BUCKET, runId: LATEST_RUN_ID })
      ),
      'replace'
    );
  }, [data.buckets, nav, onNav]);

  useEffect(() => {
    if (!nav.bucketId || nav.runId) return;
    onNav(
      navigateReport(nav, clearPlayerNav({ runId: LATEST_RUN_ID })),
      'replace'
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

  const showTest = nav.testId != null;
  const emptySuite =
    !showTest && data.runs.length === 0 && data.tests.length === 0;

  if (emptySuite) {
    return (
      <Box sx={appShellSx}>
        <Box sx={appBodyFrameSx}>
          <Text sx={emptySx}>
            No report dump yet. Run `@product/test` to write the latest results
            into `product/console/public/reports`.
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={fillSx}>
      <Box sx={visibilitySx(!showTest)}>
        <SuitePage
          bucketId={nav.bucketId}
          runId={runLabel}
          tests={data.tests}
          updatedAtMs={data.suiteUpdatedAtMs}
          onOpenTest={(testId) => {
            onNav(navigateReport(nav, clearPlayerNav({ testId })));
          }}
        />
      </Box>
      {testVisited ? (
        <Box sx={visibilitySx(showTest)}>
          <TestOrLoading
            nav={nav}
            data={data}
            concreteRunId={concreteRunId}
            onNav={onNav}
            api={api}
          />
        </Box>
      ) : null}
    </Box>
  );
}
function TestOrLoading(props: {
  readonly nav: ReportNavState;
  readonly data: ReportDataApi;
  readonly concreteRunId: string | null;
  readonly onNav: (nav: ReportNavState, mode?: 'push' | 'replace') => void;
  readonly api: ReportApiClient;
}) {
  const { nav, data, concreteRunId, onNav, api } = props;
  const bodySx = useAppBodyContentSx();
  if (nav.testId == null) {
    return <Box sx={fillSx} />;
  }
  if (!concreteRunId) {
    return (
      <Box sx={appShellSx}>
        <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
          <Text sx={emptySx}>
            {data.runs.length === 0
              ? 'No report dump yet. Run `@product/test` to generate reports.'
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
