import { deleteRunApi, pruneBucket } from './api-client';
import { BucketPicker } from './bucket-picker';
import type { ReportNavState } from './router';
import { clearPlayerNav, navigateReport } from './router';
import { RunsPage } from './runs-page';
import { SuitePage } from './suite-page';
import { TestPlayer } from './test-player';
import type { ReportDataApi } from './use-report-data';

export function ReportViews(props: {
  readonly nav: ReportNavState;
  readonly data: ReportDataApi;
  readonly generation: number;
  readonly bucketLabel: string;
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const { nav, data, generation, bucketLabel, onNav } = props;

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
      <RunsPage
        bucketId={nav.bucketId}
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
        onDeleteRun={async (runId) => {
          await deleteRunApi(nav.bucketId!, runId);
          await data.refreshRuns(nav.bucketId!);
        }}
        onKeepLast={async (n) => {
          await pruneBucket(nav.bucketId!, { keepLast: n });
          await data.refreshRuns(nav.bucketId!);
        }}
      />
    );
  }

  if (nav.testId) {
    if (!data.testData) {
      return (
        <div className="suite-page">
          <p className="empty">
            {data.error
              ? `Failed to load test: ${data.error}`
              : 'Loading test…'}
          </p>
        </div>
      );
    }
    return (
      <TestPlayer
        data={data.testData}
        nav={nav}
        bucketId={nav.bucketId}
        runId={nav.runId}
        onNav={onNav}
      />
    );
  }

  return (
    <SuitePage
      bucketId={nav.bucketId}
      runId={nav.runId}
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
