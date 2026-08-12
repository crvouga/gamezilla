import { isLatestRunId, LATEST_RUN_ID } from '../types';
import { deleteRunApi, pruneBucket } from './api-client';
import { BucketPicker } from './bucket-picker';
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
  readonly bucketLabel: string;
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const { nav, data, generation, bucketLabel, onNav } = props;
  const concreteRunId = data.resolvedRunId;

  if (!nav.bucketId) {
    return (
      <BucketPicker
        buckets={data.buckets}
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
        bucketLabel={bucketLabel}
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
      bucketId={nav.bucketId}
      runId={runLabel}
      tests={data.tests}
      onBack={() => {
        onNav(navigateReport(nav, clearPlayerNav({ runId: null })));
      }}
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
  readonly bucketLabel: string;
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const { nav, data, generation, bucketLabel, onNav } = props;
  return (
    <RunsPage
      bucketId={nav.bucketId!}
      bucketLabel={bucketLabel}
      runs={data.runs}
      generation={generation}
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
  if (!concreteRunId) {
    return (
      <div style={styles.suitePage}>
        <p style={styles.empty}>
          {isLatestRunId(nav.runId)
            ? 'Waiting for the latest run…'
            : data.error
              ? `Failed to resolve run: ${data.error}`
              : 'Loading run…'}
        </p>
      </div>
    );
  }
  if (!data.testData) {
    return (
      <div style={styles.suitePage}>
        <p style={styles.empty}>
          {data.error ? `Failed to load test: ${data.error}` : 'Loading test…'}
        </p>
      </div>
    );
  }
  return (
    <TestPlayer
      data={data.testData}
      nav={nav}
      bucketId={nav.bucketId!}
      runId={concreteRunId}
      onNav={onNav}
    />
  );
}
