import { isLatestRunId, LATEST_RUN_ID } from '../types';
import { deleteRunApi, pruneBucket } from './api-client';
import { BucketPicker } from './bucket-picker';
import { NavBreadcrumb } from './nav-breadcrumb';
import { ReportHeader } from './report-header';
import type { ReportNavState } from './router';
import { clearPlayerNav, navigateReport } from './router';
import { RunsPage } from './runs-page';
import { SuitePage } from './suite-page';
import { TestPlayer } from './test-player';
import { styles } from './theme';
import type { ReportDataApi } from './use-report-data';

export function ReportViews(props: {
  readonly nav: ReportNavState;
  readonly data: ReportDataApi;
  readonly generation: number;
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const { nav, data, generation, onNav } = props;
  const concreteRunId = data.resolvedRunId;

  if (!nav.bucketId) {
    return (
      <BucketPicker
        nav={nav}
        buckets={data.buckets}
        runs={data.runs}
        tests={data.tests}
        onNav={onNav}
        onOpen={(bucketId) => {
          onNav(navigateReport(nav, clearPlayerNav({ bucketId, runId: null })));
        }}
      />
    );
  }

  if (!nav.runId) {
    return (
      <RunsListView
        nav={nav}
        data={data}
        generation={generation}
        onNav={onNav}
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
}) {
  const { nav, data, generation, onNav } = props;
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
        await deleteRunApi(nav.bucketId!, runId);
      }}
      onKeepLast={async (n) => {
        await pruneBucket(nav.bucketId!, { keepLast: n });
      }}
    />
  );
}

function TestOrLoading(props: {
  readonly nav: ReportNavState;
  readonly data: ReportDataApi;
  readonly concreteRunId: string | null;
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const { nav, data, concreteRunId, onNav } = props;
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
      <div style={styles.appShell}>
        <ReportHeader breadcrumb={crumb} />
        <div style={styles.appBody}>
          <p style={styles.empty}>
            {isLatestRunId(nav.runId)
              ? 'Waiting for the latest run…'
              : data.error
                ? `Failed to resolve run: ${data.error}`
                : 'Loading run…'}
          </p>
        </div>
      </div>
    );
  }
  if (!data.testData) {
    return (
      <div style={styles.appShell}>
        <ReportHeader breadcrumb={crumb} />
        <div style={styles.appBody}>
          <p style={styles.empty}>
            {data.error
              ? `Failed to load test: ${data.error}`
              : 'Loading test…'}
          </p>
        </div>
      </div>
    );
  }
  return (
    <TestPlayer
      data={data.testData}
      nav={nav}
      bucketId={nav.bucketId!}
      runId={concreteRunId}
      buckets={data.buckets}
      runs={data.runs}
      tests={data.tests}
      onNav={onNav}
    />
  );
}
