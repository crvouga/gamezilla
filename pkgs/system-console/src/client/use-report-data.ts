import { useEffect } from 'react';
import { useState } from 'react';

import type {
  RunSummary,
  SimulationReportData,
  SuiteTestSummary,
} from '../types';
import { isLatestRunId } from '../types';
import type { BucketInfo, ReportApiClient } from './api-client';
import type { ReportNavState } from './router';
import { clearPlayerNav, navigateReport } from './router';

export type ReportDataApi = {
  readonly buckets: readonly BucketInfo[];
  readonly runs: readonly RunSummary[];
  readonly tests: readonly SuiteTestSummary[];
  readonly generation: number;
  /** Concrete run id when following `latest`, else nav.runId. */
  readonly resolvedRunId: string | null;
  readonly testData: SimulationReportData | null;
  readonly error: string | null;
};

/**
 * Reactive report data over SSE. Opens `/api/events` for buckets and
 * `/api/buckets/:id/events` for runs/manifest/test keyed off nav.
 */
export function useReportData(
  nav: ReportNavState,
  setNav: (nav: ReportNavState) => void,
  api: ReportApiClient
): ReportDataApi {
  const [buckets, setBuckets] = useState<readonly BucketInfo[]>([]);
  const [runs, setRuns] = useState<readonly RunSummary[]>([]);
  const [tests, setTests] = useState<readonly SuiteTestSummary[]>([]);
  const [generation, setGeneration] = useState(0);
  const [resolvedRunId, setResolvedRunId] = useState<string | null>(null);
  const [testData, setTestData] = useState<SimulationReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = api.openBucketsEvents({
      onBuckets: (list) => {
        setBuckets(list);
        setError(null);
      },
      onError: () => setError('buckets stream error'),
    });
    return () => handle.close();
  }, [api]);

  useEffect(() => {
    if (!nav.bucketId) {
      setRuns([]);
      setGeneration(0);
      setTests([]);
      setTestData(null);
      setResolvedRunId(null);
      return;
    }

    const bucketId = nav.bucketId;
    const handle = api.openBucketEvents({
      bucketId,
      runId: nav.runId,
      testId: nav.testId,
      handlers: {
        onRuns: (ev) => {
          setRuns(ev.runs);
          setGeneration(ev.generation);
          setError(null);
          applyRunsNavGuards({
            current: nav,
            bucketId,
            runs: ev.runs,
            setNav,
            clearTest: () => setTestData(null),
          });
        },
        onManifest: (ev) => {
          setResolvedRunId(ev.resolvedRunId);
          setTests(ev.tests);
          if (ev.missing && nav.runId && !isLatestRunId(nav.runId)) {
            setNav(navigateReport(nav, clearPlayerNav({ runId: null })));
            setTestData(null);
          }
        },
        onTest: (ev) => {
          if (ev.resolvedRunId != null) setResolvedRunId(ev.resolvedRunId);
          if (ev.missing || !ev.data) {
            setTestData(null);
            if (nav.testId && !ev.missing) return;
            if (nav.testId && ev.missing) {
              setNav(navigateReport(nav, clearPlayerNav()));
            }
            return;
          }
          setTestData(ev.data);
          setError(null);
        },
        onError: () => setError('bucket stream error'),
      },
    });

    return () => handle.close();
  }, [api, nav, setNav]);

  return {
    buckets,
    runs,
    tests,
    generation,
    resolvedRunId:
      resolvedRunId ??
      (nav.runId && !isLatestRunId(nav.runId) ? nav.runId : null),
    testData,
    error,
  };
}

function applyRunsNavGuards(args: {
  readonly current: ReportNavState;
  readonly bucketId: string;
  readonly runs: readonly RunSummary[];
  readonly setNav: (nav: ReportNavState) => void;
  readonly clearTest: () => void;
}): void {
  const { current } = args;
  if (current.bucketId !== args.bucketId || !current.runId) return;
  if (isLatestRunId(current.runId)) return;
  const stillThere = args.runs.some((r) => r.id === current.runId);
  if (!stillThere) {
    args.setNav(navigateReport(current, clearPlayerNav({ runId: null })));
    args.clearTest();
  }
}
